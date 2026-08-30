"use strict"

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod }
}

Object.defineProperty(exports, "__esModule", { value: true })

const node_cache_1 = __importDefault(require("@cacheable/node-cache"))
const boom_1 = require("@hapi/boom")
const crypto_1 = require("crypto")
const WAProto_1 = require("../../WAProto")
const Defaults_1 = require("../Defaults")
const Utils_1 = require("../Utils")
const Types_1 = require("../Types")
const WABinary_1 = require("../WABinary")
const WAUSync_1 = require("../WAUSync")
const newsletter_1 = require("./newsletter")
const link_preview_1 = require("../Utils/link-preview")
const make_keyed_mutex_1 = require("../Utils/make-mutex")
const message_composer_1 = require("../Utils/message-composer")

const makeMessagesSocket = (config) => {
    const { logger, maxMsgRetryCount, linkPreviewImageThumbnailWidth, generateHighQualityLinkPreview, options: axiosOptions, patchMessageBeforeSending, cachedGroupMetadata, enableRecentMessageCache } = config
    const vare = newsletter_1.makeNewsletterSocket(config)
    const { ev, authState, processingMutex, signalRepository, upsertMessage, createCallLink, query, fetchPrivacySettings, sendNode, groupQuery, groupMetadata, groupToggleEphemeral, newsletterWMexQuery, executeUSyncQuery } = vare

    const userDevicesCache = config.userDevicesCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.USER_DEVICES,
        useClones: false
    })
    const ephemeralCache = new Map()
    const EPHEMERAL_CACHE_TTL = 5 * 60 * 1000
    const messageRetryManager = enableRecentMessageCache ? new Utils_1.MessageRetryManager(logger, maxMsgRetryCount) : null
    const encryptionMutex = make_keyed_mutex_1.makeKeyedMutex()

    let mediaConn

    const refreshMediaConn = async (forceGet = false) => {
        const media = await mediaConn

        if (!media || forceGet || (new Date().getTime() - media.fetchDate.getTime()) > media.ttl * 1000) {
            mediaConn = (async () => {

                const result = await query({
                    tag: 'iq',
                    attrs: {
                        type: 'set',
                        xmlns: 'w:m',
                        to: WABinary_1.S_WHATSAPP_NET,
                    },
                    content: [{ tag: 'media_conn', attrs: {} }]
                })

                const mediaConnNode = WABinary_1.getBinaryNodeChild(result, 'media_conn')

                const node = {
                    hosts: WABinary_1.getBinaryNodeChildren(mediaConnNode, 'host').map(({ attrs }) => ({
                        hostname: attrs.hostname,
                        maxContentLengthBytes: +attrs.maxContentLengthBytes,
                    })),
                    auth: mediaConnNode.attrs.auth,
                    ttl: +mediaConnNode.attrs.ttl,
                    fetchDate: new Date()
                }

                logger.debug('fetched media conn')

                return node
            })()
        }

        return mediaConn
    }

    const sendReceipt = async (jid, participant, messageIds, type) => {
        const node = {
            tag: 'receipt',
            attrs: {
                id: messageIds[0],
            },
        }

        const isReadReceipt = type === 'read' || type === 'read-self'

        if (isReadReceipt) {
            node.attrs.t = Utils_1.unixTimestampSeconds().toString()
        }

        if (type === 'sender' && WABinary_1.isJidUser(jid)) {
            node.attrs.recipient = jid
            node.attrs.to = participant
        }

        else {
            node.attrs.to = jid
            if (participant) {
                node.attrs.participant = participant
            }
        }

        if (type) {
            node.attrs.type = WABinary_1.isJidNewsletter(jid) ? 'read-self' : type
        }

        const remainingMessageIds = messageIds.slice(1)

        if (remainingMessageIds.length) {
            node.content = [
                {
                    tag: 'list',
                    attrs: {},
                    content: remainingMessageIds.map(id => ({
                        tag: 'item',
                        attrs: { id }
                    }))
                }
            ]
        }

        logger.debug({ attrs: node.attrs, messageIds }, 'sending receipt for messages')
        await sendNode(node)
    }
    const sendReceipts = async (keys, type) => {
        const recps = Utils_1.aggregateMessageKeysNotFromMe(keys)

        await Promise.all(recps.map(({ jid, participant, messageIds }) => sendReceipt(jid, participant, messageIds, type)))
    }

    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings()
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self'

        await sendReceipts(keys, readType)
    }

    const deduplicateLidPnJids = (jids) => {
        const lidUsers = new Set()
        const filteredJids = []
        for (const jid of jids) {
            if (WABinary_1.isLidUser(jid)) {
                const user = WABinary_1.jidDecode(jid)?.user
                if (user)
                    lidUsers.add(user)
            }
        }

        for (const jid of jids) {
            if (WABinary_1.isJidUser(jid)) {
                const user = WABinary_1.jidDecode(jid)?.user
                if (user && lidUsers.has(user)) {
                    logger.debug({ jid }, 'Skipping PN - LID version exists')
                    continue
                }
            }
            filteredJids.push(jid)
        }
        return filteredJids
    }

    /** Fetch image for groups, user, and newsletter **/
    const profilePictureUrl = async (jid) => {
        if (WABinary_1.isJidNewsletter(jid)) {

            let node = await newsletterWMexQuery(undefined, Types_1.QueryIds.METADATA, {
                input: {
                    key: jid,
                    type: 'JID',
                    view_role: 'GUEST'
                },
                fetch_viewer_metadata: true,
                fetch_full_image: true,
                fetch_creation_time: true
            })

            let result = WABinary_1.getBinaryNodeChild(node, 'result')?.content?.toString()

            let metadata = JSON.parse(result).data[Types_1.XWAPaths.NEWSLETTER]

            return Utils_1.getUrlFromDirectPath(metadata.thread_metadata.picture?.direct_path || '')

        }

        else {
            const result = await query({
                tag: 'iq',
                attrs: {
                    target: WABinary_1.jidNormalizedUser(jid),
                    to: WABinary_1.S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:profile:picture'
                },
                content: [{
                    tag: 'picture',
                    attrs: {
                        type: 'image',
                        query: 'url'
                    }
                }]
            })

            const child = WABinary_1.getBinaryNodeChild(result, 'picture')

            return child?.attrs?.url || null
        }
    }

    /** Fetch all the devices we've to send a message to */
    const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = []

        if (!useCache) {
            logger.debug('not using cache for devices')
        }

        const toFetch = []

        jids = deduplicateLidPnJids(Array.from(new Set(jids)))
        const jidsWithUser = jids
            .map(jid => {
                const decoded = WABinary_1.jidDecode(jid)
                const user = decoded?.user
                const device = decoded?.device
                const isExplicitDevice = typeof device === 'number' && device >= 0

                if (isExplicitDevice && user) {
                    deviceResults.push({
                        user,
                        device,
                        wireJid: jid // again this makes no sense
                    });
                    return null
                }

                jid = WABinary_1.jidNormalizedUser(jid)
                return { jid, user }
            })
            .filter(jid => jid !== null)

        let mgetDevices

        if (useCache && userDevicesCache.mget) {
            const usersToFetch = jidsWithUser.map(j => j?.user).filter(Boolean)
            mgetDevices = await userDevicesCache.mget(usersToFetch)
        }

        for (const { jid, user } of jidsWithUser) {
            if (useCache) {
                const devices = mgetDevices?.[user] ||
                    (userDevicesCache.mget ? undefined : (await userDevicesCache.get(user)))

                if (devices) {
                    const isLidJid = WABinary_1.isLidUser(jid)
                    const devicesWithWire = devices.map(d => ({
                        ...d,
                        wireJid: isLidJid ? WABinary_1.jidEncode(d.user, 'lid', d.device) : WABinary_1.jidEncode(d.user, 's.whatsapp.net', d.device)
                    }))

                    deviceResults.push(...devicesWithWire)
                    logger.trace({ user }, 'using cache for devices')
                }
                else {
                    toFetch.push(jid)
                }
            }
            else {
                toFetch.push(jid)
            }
        }

        if (!toFetch.length) {
            return deviceResults
        }

        const requestedLidUsers = new Set()
        for (const jid of toFetch) {
            if (WABinary_1.isLidUser(jid)) {
                const user = WABinary_1.jidDecode(jid)?.user
                if (user)
                    requestedLidUsers.add(user)
            }
        }

        const query = new WAUSync_1.USyncQuery().withContext('message').withDeviceProtocol()
        for (const jid of toFetch) {
            query.withUser(new WAUSync_1.USyncUser().withId(jid))
        }

        const result = await executeUSyncQuery(query)

        if (result) {
            const extracted = Utils_1.extractDeviceJids(result?.list, authState.creds.me.id, ignoreZeroDevices)
            const deviceMap = {}

            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || []
                deviceMap[item.user]?.push(item)
            }

            for (const [user, userDevices] of Object.entries(deviceMap)) {
                const isLidUser = requestedLidUsers.has(user)
                for (const item of userDevices) {
                    const finalWireJid = isLidUser
                        ? WABinary_1.jidEncode(user, 'lid', item.device)
                        : WABinary_1.jidEncode(item.user, 's.whatsapp.net', item.device)
                    deviceResults.push({
                        ...item,
                        wireJid: finalWireJid
                    });
                }
            }

            if (userDevicesCache.mset) {
                await userDevicesCache.mset(Object.entries(deviceMap).map(([key, value]) => ({ key, value })))
            }

            else {
                for (const key in deviceMap) {
                    if (deviceMap[key])
                        await userDevicesCache.set(key, deviceMap[key])
                }
            }

        }
        return deviceResults
    }

    const updateMemberLabel = (jid, memberLabel) => {
        if (!WABinary_1.isJidGroup(jid)) {
            throw new Error('Jid must a group!')
        }

        const protocolMessage = {
            protocolMessage: {
                type: WAProto_1.proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE,
                memberLabel: {
                    label: memberLabel?.slice(0, 30),
                    labelTimestamp: Utils_1.unixTimestampSeconds()
                }
            }
        }

        return relayMessage(jid, protocolMessage, {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {
                        tag_reason: 'user_update',
                        appdata: 'member_tag'
                    }
                }
            ]
        })
    }

    const assertSessions = async (jids, force) => {
        let didFetchNewSession = false
        const jidsRequiringFetch = []

        jids = deduplicateLidPnJids(jids)

        if (force) {
            const addrs = jids.map(jid => signalRepository.jidToSignalProtocolAddress(jid))
            const sessions = await authState.keys.get('session', addrs)

            const checkJidSession = (jid) => {
                const signalId = signalRepository.jidToSignalProtocolAddress(jid)
                const hasSession = !!sessions[signalId]

                if (!hasSession) {
                    if (jid.includes('@lid')) {
                        logger.debug({ jid }, 'No LID session found, will create new LID session')
                    }
                    jidsRequiringFetch.push(jid)
                }
            }

            for (const jid of jids) {
                checkJidSession(jid)
            }
        }
        else {
            const addrs = jids.map(jid => signalRepository.jidToSignalProtocolAddress(jid))
            const sessions = await authState.keys.get('session', addrs)

            const userGroups = new Map()
            for (const jid of jids) {
                const user = WABinary_1.jidNormalizedUser(jid)
                if (!userGroups.has(user)) {
                    userGroups.set(user, [])
                }
                userGroups.get(user).push(jid)
            }

            const pnJidsToFetch = Array.from(userGroups.entries())
                .filter(([_, userJids]) => userJids.some(jid => WABinary_1.isJidUser(jid)))
                .map(([user]) => `${user}@s.whatsapp.net`);

            const lidMappings = await Promise.all(
                pnJidsToFetch.map(pnJid =>
                    signalRepository.lidMapping.getLIDForPN(pnJid)
                        .then(mapping => ({ pnJid, mapping }))
                        .catch(error => {
                            logger.debug({ pnJid, error }, 'Failed to check LID mapping for user');
                            return { pnJid, mapping: undefined };
                        })
                )
            );
            const mappingDict = Object.fromEntries(lidMappings.map(x => [x.pnJid, x.mapping]));
            const checkUserLidMapping = (user, userJids) => {
                if (!userJids.some(jid => WABinary_1.isJidUser(jid))) {
                    return { shouldMigrate: false, lidForPN: undefined }
                }

                const pnJid = `${user}@s.whatsapp.net`;
                const mapping = mappingDict[pnJid];

                if (mapping?.includes('@lid')) {
                    logger.debug({ user, lidForPN: mapping, deviceCount: userJids.length }, 'User has LID mapping - preparing bulk migration')
                    return { shouldMigrate: true, lidForPN: mapping }
                }

                return { shouldMigrate: false, lidForPN: undefined }
            }

            for (const [user, userJids] of userGroups) {
                const mappingResult = checkUserLidMapping(user, userJids)
                const shouldMigrateUser = mappingResult.shouldMigrate
                const lidForPN = mappingResult.lidForPN

                if (shouldMigrateUser && lidForPN) {
                    const migrationResult = await signalRepository.migrateSession(userJids, lidForPN)

                    if (migrationResult.migrated > 0) {
                        logger.debug({
                            user,
                            lidMapping: lidForPN,
                            migrated: migrationResult.migrated,
                            skipped: migrationResult.skipped,
                            total: migrationResult.total
                        }, 'Completed bulk migration for user devices');
                    }
                    else {
                        logger.debug({
                            user,
                            lidMapping: lidForPN,
                            skipped: migrationResult.skipped,
                            total: migrationResult.total
                        }, 'All user device sessions already migrated');
                    }
                }

                const addMissingSessionsToFetchList = (jid) => {
                    const signalId = signalRepository.jidToSignalProtocolAddress(jid)

                    if (sessions[signalId]) return

                    if (jid.includes('@s.whatsapp.net') && shouldMigrateUser && lidForPN) {
                        const decoded = WABinary_1.jidDecode(jid)
                        const lidDeviceJid = decoded.device !== undefined ? `${WABinary_1.jidDecode(lidForPN).user}:${decoded.device}@lid` : lidForPN

                        jidsRequiringFetch.push(lidDeviceJid)
                        logger.debug({ pnJid: jid, lidJid: lidDeviceJid }, 'Adding LID JID to fetch list (conversion)')
                    }

                    else {
                        jidsRequiringFetch.push(jid)
                        logger.debug({ jid }, 'Adding JID to fetch list')
                    }
                }

                userJids.forEach(addMissingSessionsToFetchList)
            }
        }

        if (jidsRequiringFetch.length) {
            logger.debug({ jidsRequiringFetch }, 'fetching sessions')
            const lidUsersBeingFetched = new Set()
            const pnUsersBeingFetched = new Set()
            for (const jid of jidsRequiringFetch) {
                const user = WABinary_1.jidDecode(jid)?.user

                if (user) {
                    if (WABinary_1.isLidUser(jid)) {
                        lidUsersBeingFetched.add(user)
                    }
                    else if (WABinary_1.isJidUser(jid)) {
                        pnUsersBeingFetched.add(user)
                    }
                }
            }

            const overlapping = Array.from(pnUsersBeingFetched).filter(user => lidUsersBeingFetched.has(user))
            if (overlapping.length > 0) {
                logger.warn({
                    overlapping,
                    lidUsersBeingFetched: Array.from(lidUsersBeingFetched),
                    pnUsersBeingFetched: Array.from(pnUsersBeingFetched)
                }, 'Fetching both LID and PN sessions for same users')
            }

            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: WABinary_1.S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: jidsRequiringFetch.map(jid => ({
                            tag: 'user',
                            attrs: { jid }
                        }))
                    }
                ]
            })

            await Utils_1.parseAndInjectE2ESessions(result, signalRepository)
            didFetchNewSession = true
        }
        return didFetchNewSession
    }

    /** Send Peer Message */
    const sendPeerMessage = async (message) => {
        if (!authState.creds.me?.id) {
            throw new boom_1.Boom('Not authenticated')
        }

        const protocolMessage = {
            protocolMessage: {
                ...message
            }
        }

        const meJid = WABinary_1.jidNormalizedUser(authState.creds.me.id)

        const msgId = await relayMessage(meJid, protocolMessage, {
            additionalAttributes: {
                category: 'peer',
                push_priority: 'high_force',
            },
        })

        return msgId
    }

    const sendPeerDataOperationMessage = async (pdoMessage) => {
        return sendPeerMessage({
            peerDataOperationRequestMessage: pdoMessage,
            type: WAProto_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
        })
    }

    const createParticipantNodes = async (jids, message, extraAttrs, dsmMessage, destinationJid) => {
        let patched = await patchMessageBeforeSending(message, jids)

        if (!Array.isArray(patched)) {
            patched = jids ? jids.map(jid => ({ recipientJid: jid, ...patched })) : [patched]
        }

        let shouldIncludeDeviceIdentity = false

        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        const meLidUser = meLid ? WABinary_1.jidDecode(meLid)?.user : null
        const devicesByUser = new Map()
        const lidMappingCache = new Map()

        for (const patchedMessageWithJid of patched) {
            const { recipientJid: wireJid, ...patchedMessage } = patchedMessageWithJid
            if (!wireJid)
                continue
            const decoded = WABinary_1.jidDecode(wireJid)
            const user = decoded?.user

            if (!user)
                continue

            if (!devicesByUser.has(user)) {
                devicesByUser.set(user, []);
            }

            devicesByUser.get(user).push({ recipientJid: wireJid, patchedMessage })
        }

        const userEncryptionPromises = Array.from(devicesByUser.entries()).map(([user, userDevices]) => encryptionMutex.mutex(user, async () => {
            logger.debug({ user, deviceCount: userDevices.length }, 'Acquiring encryption lock for user devices');
            const userNodes = []

            const getEncryptionJid = async (wireJid) => {
                if (!WABinary_1.isJidUser(wireJid))
                    return wireJid

                try {
                    const wireDecoded = WABinary_1.jidDecode(wireJid)
                    const user = wireDecoded?.user
                    if (!user)
                        return wireJid
                    const deviceId = wireDecoded?.device || 0
                    const pnJid = WABinary_1.jidEncode(user, 's.whatsapp.net')
                    let lidForPN
                    if (lidMappingCache.has(pnJid)) {
                        lidForPN = lidMappingCache.get(pnJid)
                    }
                    else {
                        lidForPN = WABinary_1.sharedLidPhoneCache.getLidForPhone(pnJid) || await signalRepository.lidMapping.getLIDForPN(pnJid)
                        lidMappingCache.set(pnJid, lidForPN || null)
                    }

                    if (!lidForPN?.includes('@lid'))
                        return wireJid

                    WABinary_1.sharedLidPhoneCache.set(lidForPN, pnJid)
                    const lidDecoded = WABinary_1.jidDecode(lidForPN)
                    const lidWithDevice = WABinary_1.jidEncode(lidDecoded?.user, 'lid', deviceId)

                    try {
                        const migrationResult = await signalRepository.migrateSession([wireJid], lidWithDevice)
                        const recipientUser = pnJid
                        const ownPnUser = WABinary_1.jidNormalizedUser(meId)
                        const isOwnDevice = recipientUser === ownPnUser
                        logger.debug({ wireJid, lidWithDevice, isOwnDevice }, 'Migrated to LID encryption')
                        try {
                            if (migrationResult.migrated) {
                                await signalRepository.deleteSession([wireJid])
                                logger.debug({ deletedPNSession: wireJid }, 'Deleted PN session')
                            }
                        }
                        catch (deleteError) {
                            logger.warn({ wireJid, error: deleteError }, 'Failed to delete PN session')
                        }
                        return lidWithDevice
                    }
                    catch (migrationError) {
                        logger.warn({ wireJid, error: migrationError }, 'Failed to migrate session')
                        return wireJid
                    }
                }
                catch (error) {
                    logger.debug({ wireJid, error }, 'Failed to check LID mapping')
                    return wireJid
                }
            }

            for (const { recipientJid: wireJid, patchedMessage } of userDevices) {
                let messageToEncrypt = patchedMessage;
                const { user: targetUser } = WABinary_1.jidDecode(wireJid);
                const { user: ownPnUser } = WABinary_1.jidDecode(meId);
                const ownLidUser = meLidUser;
                const isOwnUser = targetUser === ownPnUser || (ownLidUser && targetUser === ownLidUser);
                const isExactSenderDevice = wireJid === meId || (authState.creds.me?.lid && wireJid === authState.creds.me.lid);
                let messageToSend = patchedMessage;
                const isGroupOrStatus = destinationJid && (destinationJid === 'status@broadcast' || destinationJid.endsWith('@g.us'));
                if (isGroupOrStatus) {
                    let groupSenderIdentity;
                    if (meLid && (await signalRepository.hasSenderKey({ group: destinationJid, meId: meLid }))) {
                        groupSenderIdentity = meLid;
                    }
                    else if (await signalRepository.hasSenderKey({ group: destinationJid, meId })) {
                        groupSenderIdentity = meId;
                    }
                    if (groupSenderIdentity) {
                        try {
                            const skdm = await signalRepository.getSenderKeyDistributionMessage({
                                group: destinationJid,
                                meId: groupSenderIdentity
                            });
                            messageToSend = {
                                ...patchedMessage,
                                senderKeyDistributionMessage: {
                                    groupId: destinationJid,
                                    axolotlSenderKeyDistributionMessage: skdm
                                }
                            };
                        }
                        catch (err) {
                            logger.warn({ err, jid: destinationJid }, 'failed to build SKDM for retry, sending without it');
                        }
                    }
                }
                if (isOwnUser && !isExactSenderDevice && !messageToSend.deviceSentMessage && !messageToSend.senderKeyDistributionMessage) {
                    messageToEncrypt = {
                        deviceSentMessage: {
                            destinationJid,
                            message: messageToSend
                        },
                        messageContextInfo: patchedMessage.messageContextInfo || {}
                    };
                    logger.debug({ wireJid, targetUser }, 'Using DSM for own device');
                }
                else {
                    messageToEncrypt = messageToSend;
                }

                const bytes = Utils_1.encodeWAMessage(messageToEncrypt)

                const encryptionJid = await getEncryptionJid(wireJid)

                const { type, ciphertext } = await signalRepository.encryptMessage({
                    jid: encryptionJid,
                    data: bytes
                })

                if (type === 'pkmsg') {
                    shouldIncludeDeviceIdentity = true
                }

                const node = {
                    tag: 'to',
                    attrs: { jid: wireJid },
                    content: [
                        {
                            tag: 'enc',
                            attrs: {
                                v: '2',
                                type,
                                ...(extraAttrs || {})
                            },
                            content: ciphertext
                        }
                    ]
                }
                userNodes.push(node)
            }
            logger.debug({ user, nodesCreated: userNodes.length }, 'Releasing encryption lock for user devices');
            return userNodes
        }))

        const userNodesArrays = await Promise.all(userEncryptionPromises)
        const nodes = userNodesArrays.flat()
        return { nodes, shouldIncludeDeviceIdentity }
    }

    const relayMessage = async (jid, message, { messageId: msgId, participant, additionalAttributes, useUserDevicesCache, useCachedGroupMetadata, statusJidList, additionalNodes, AI = false, ghostJids }) => {
        try {
            let contextInfo = undefined;
            for (const key of Object.keys(message)) {
                if (message[key] && typeof message[key] === 'object' && 'contextInfo' in message[key]) {
                    contextInfo = message[key].contextInfo;
                    break;
                }
            }
            if (contextInfo?.stanzaId) {
                const quotedId = contextInfo.stanzaId;
                const quotedParticipant = contextInfo.participant || contextInfo.remoteJid;
                const privacySettings = await fetchPrivacySettings().catch(() => ({ readreceipts: 'all' }));
                const readType = (privacySettings === null || privacySettings === void 0 ? void 0 : privacySettings.readreceipts) === 'all' ? 'read' : 'read-self';
                await sendReceipt(jid, quotedParticipant, [quotedId], readType).catch(() => { });
            }
        } catch (e) {
            logger.debug({ err: e }, 'failed to auto-read quoted message in relayMessage');
        }
        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        let didPushAdditional = false
        let shouldIncludeDeviceIdentity = false
        const { user, server } = WABinary_1.jidDecode(jid)
        const statusJid = 'status@broadcast'
        const isGroup = server === 'g.us'
        const isPrivate = server === 's.whatsapp.net'
        const isNewsletter = server == 'newsletter'
        const isStatus = jid === statusJid
        const isLid = server === 'lid'
        const finalJid = jid
        let ownId = meId
        if (isLid && meLid) {
            ownId = meLid
            logger.debug({ to: jid, ownId }, 'Using LID identity for @lid conversation')
        }
        else {
            logger.debug({ to: jid, ownId }, 'Using PN identity for @s.whatsapp.net conversation')
        }

        msgId = msgId || Utils_1.generateMessageID(authState.creds.me.id)
        useUserDevicesCache = useUserDevicesCache !== false
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus
        const participants = []
        const destinationJid = !isStatus ? finalJid : statusJid
        const binaryNodeContent = []
        const devices = []
        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            },
            messageContextInfo: message.messageContextInfo || {}
        }

        const extraAttrs = {}
        const regexGroupOld = /^(\d{1,15})-(\d+)@g\.us$/
        const messages = Utils_1.normalizeMessageContent(message)
        const buttonType = getButtonType(messages)
        const pollMessage = messages.pollCreationMessage || messages.pollCreationMessageV2 || messages.pollCreationMessageV3

        if (participant) {
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, 'device_fanout': 'false' }
            }

            const { user, device } = WABinary_1.jidDecode(participant.jid)
            devices.push({
                user,
                device,
                wireJid: participant.jid
            })
        }

        await authState.keys.transaction(async () => {
            const mediaType = getMediaType(messages)

            if (mediaType) {
                extraAttrs['mediatype'] = mediaType
            }

            if (messages.pinInChatMessage || messages.keepInChatMessage || message.reactionMessage || message.protocolMessage?.editedMessage) {
                extraAttrs['decrypt-fail'] = 'hide'
            }

            if (messages.interactiveResponseMessage?.nativeFlowResponseMessage) {
                extraAttrs['native_flow_name'] = messages.interactiveResponseMessage.nativeFlowResponseMessage?.name || 'menu_options'
            }

            if (isGroup || isStatus) {
                if (ghostJids) {
                    const keysToClear = {}
                    const { user: userJid, device: deviceJid } = WABinary_1.jidDecode(meId)
                    keysToClear[jid + '::' + userJid + '::' + (deviceJid || 0)] = null

                    if (meLid) {
                        const { user: userLid, device: deviceLid } = WABinary_1.jidDecode(meLid)
                        keysToClear[jid + '::' + userLid + '::' + (deviceLid || 0)] = null
                    }

                    await authState.keys.set({
                        'sender-key': keysToClear,
                        'sender-key-memory': { [jid]: null }
                    })
                    
                    authState.ghostKeyPendingClear = authState.ghostKeyPendingClear || {}
                    authState.ghostKeyPendingClear[jid] = true
                } else if (authState.ghostKeyPendingClear?.[jid]) {
                    const keysToClear = {}
                    const { user: userJid, device: deviceJid } = WABinary_1.jidDecode(meId)
                    keysToClear[jid + '::' + userJid + '::' + (deviceJid || 0)] = null

                    if (meLid) {
                        const { user: userLid, device: deviceLid } = WABinary_1.jidDecode(meLid)
                        keysToClear[jid + '::' + userLid + '::' + (deviceLid || 0)] = null
                    }

                    await authState.keys.set({
                        'sender-key': keysToClear,
                        'sender-key-memory': { [jid]: null }
                    })
                    
                    delete authState.ghostKeyPendingClear[jid]
                }
            }

            if (isGroup || isStatus) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined
                        if (groupData && Array.isArray(groupData?.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata')
                        }
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid)
                        }
                        return groupData
                    })(),

                    (async () => {
                        if (!participant && !isStatus) {
                            const result = await authState.keys.get('sender-key-memory', [jid])
                            return result[jid] || {}
                        }
                        return {}
                    })()
                ])

                if (!participant) {
                    const participantsList = (groupData && !isStatus) ? groupData.participants.map(p => p.id) : []

                    if (isStatus && statusJidList) {
                        participantsList.push(...statusJidList)
                    }
                    if (!isStatus) {
                        const groupAddressingMode = groupData?.addressingMode || (isLid ? Types_1.WAMessageAddressingMode.LID : Types_1.WAMessageAddressingMode.PN)
                        additionalAttributes = {
                            ...additionalAttributes,
                            addressing_mode: groupAddressingMode
                        }
                    }

                    const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false)
                    devices.push(...additionalDevices)
                }

                const patched = await patchMessageBeforeSending(message, devices.map(d => WABinary_1.jidEncode(d.user, isLid ? 'lid' : 's.whatsapp.net', d.device)))
                const bytes = Utils_1.encodeWAMessage(patched)
                const groupAddressingMode = groupData?.addressingMode || (isLid ? 'lid' : 'pn')
                const groupSenderIdentity = groupAddressingMode === 'lid' && meLid ? meLid : meId
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: groupSenderIdentity
                })

                if (ghostJids) {
                    authState.lastGhostSkdm = authState.lastGhostSkdm || {}
                    authState.lastGhostSkdm[destinationJid] = senderKeyDistributionMessage
                }

                const senderKeyJids = []
                for (const device of devices) {
                    const deviceJid = device.wireJid
                    const hasKey = !!senderKeyMap[deviceJid]
                    let isGhostTarget = true
                    if (ghostJids) {
                        const { user: myUser } = WABinary_1.jidDecode(meId)
                        const myLidUser = meLid ? WABinary_1.jidDecode(meLid).user : null
                        isGhostTarget = ghostJids.some(j => j.startsWith(device.user + '@') || j.startsWith(device.user + ':') || j === deviceJid) || device.user === myUser || device.user === myLidUser
                    }
                    if (isGhostTarget && (!hasKey || !!participant)) {
                        senderKeyJids.push(deviceJid)
                        senderKeyMap[deviceJid] = true
                    }
                }
                if (senderKeyJids.length) {
                    logger.debug({ senderKeyJids }, 'sending new sender key')
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    }

                    await assertSessions(senderKeyJids, false)
                    const result = await createParticipantNodes(senderKeyJids, senderKeyMsg, extraAttrs)
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity
                    participants.push(...result.nodes)
                }

                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg', ...extraAttrs },
                    content: ciphertext
                })

                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } })
            }

            else if (isNewsletter) {
                // Message edit
                if (message.protocolMessage?.editedMessage) {
                    msgId = message.protocolMessage.key?.id
                    message = message.protocolMessage.editedMessage
                }

                // Message delete
                if (message.protocolMessage?.type === WAProto_1.proto.Message.ProtocolMessage.Type.REVOKE) {
                    msgId = message.protocolMessage.key?.id
                    message = {}
                }

                const patched = await patchMessageBeforeSending(message, [])
                const bytes = Utils_1.encodeNewsletterMessage(patched)

                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: extraAttrs,
                    content: bytes
                })
            }

            else {
                const { user: ownUser } = WABinary_1.jidDecode(ownId)

                if (!participant) {
                    const targetUserServer = isLid ? 'lid' : 's.whatsapp.net'
                    devices.push({
                        user,
                        device: 0,
                        wireJid: WABinary_1.jidEncode(user, targetUserServer, 0)
                    })
                    if (user !== ownUser) {
                        const ownUserServer = isLid ? 'lid' : 's.whatsapp.net';
                        const ownUserForAddressing = isLid && meLid ? WABinary_1.jidDecode(meLid).user : WABinary_1.jidDecode(meId).user
                        devices.push({
                            user: ownUserForAddressing,
                            device: 0,
                            wireJid: WABinary_1.jidEncode(ownUserForAddressing, ownUserServer, 0)
                        })
                    }

                    if (additionalAttributes?.['category'] !== 'peer') {
                        devices.length = 0
                        const senderIdentity = isLid && meLid
                            ? WABinary_1.jidEncode(WABinary_1.jidDecode(meLid)?.user, 'lid', undefined)
                            : WABinary_1.jidEncode(WABinary_1.jidDecode(meId)?.user, 's.whatsapp.net', undefined)
                        const sessionDevices = await getUSyncDevices([senderIdentity, jid], !!useUserDevicesCache, false)
                        devices.push(...sessionDevices)
                        logger.debug({
                            deviceCount: devices.length,
                            devices: devices.map(d => `${d.user}:${d.device}@${WABinary_1.jidDecode(d.wireJid)?.server}`)
                        }, 'Device enumeration complete with unified addressing')
                    }
                }

                const allJids = []
                const meJids = []
                const otherJids = []

                const { user: mePnUser } = WABinary_1.jidDecode(meId)
                const { user: meLidUser } = meLid ? WABinary_1.jidDecode(meLid) : { user: null }

                for (const { user, wireJid } of devices) {
                    const isExactSenderDevice = wireJid === meId || (meLid && wireJid === meLid)
                    if (isExactSenderDevice) {
                        logger.debug({ wireJid, meId, meLid }, 'Skipping exact sender device (whatsmeow pattern)')
                        continue
                    }

                    const isMe = user === mePnUser || (meLidUser && user === meLidUser)
                    const jid = wireJid

                    if (isMe) {
                        meJids.push(jid)
                    }

                    else {
                        otherJids.push(jid)
                    }

                    allJids.push(jid)
                }

                await assertSessions([...otherJids, ...meJids], false)

                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                    createParticipantNodes(meJids, meMsg || message, extraAttrs, undefined, destinationJid),
                    createParticipantNodes(otherJids, message, extraAttrs, meMsg, destinationJid)
                ])

                participants.push(...meNodes)

                participants.push(...otherNodes)

                if (meJids.length > 0 || otherJids.length > 0) {
                    extraAttrs['phash'] = Utils_1.generateParticipantHashV2([...meJids, ...otherJids])
                }

                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2
            }

            if (participants.length) {
                if (additionalAttributes?.['category'] === 'peer') {
                    const peerNode = participants[0]?.content?.[0]

                    if (peerNode) {
                        binaryNodeContent.push(peerNode)
                    }
                }

                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    })
                }
            }

            const stanza = {
                tag: 'message',
                attrs: {
                    to: destinationJid,
                    id: msgId,
                    type: getTypeMessage(message),
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            }

            if (participant) {
                if (WABinary_1.isJidGroup(destinationJid)) {
                    stanza.attrs.to = destinationJid
                    stanza.attrs.participant = participant.jid
                }

                else if (WABinary_1.areJidsSameUser(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid
                    stanza.attrs.recipient = destinationJid
                }

                else {
                    stanza.attrs.to = participant.jid
                }
            }

            else {
                stanza.attrs.to = destinationJid
            }

            if (shouldIncludeDeviceIdentity) {
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: Utils_1.encodeSignedDeviceIdentity(authState.creds.account, true)
                })

                logger.debug({ jid }, 'adding device identity')
            }

            if (isGroup && regexGroupOld.test(jid) && !message.reactionMessage) {
                stanza.content.push({
                    tag: 'multicast',
                    attrs: {}
                })
            }

            if (pollMessage || messages.eventMessage) {
                stanza.content.push({
                    tag: 'meta',
                    attrs: messages.eventMessage ? {
                        event_type: 'creation'
                    } : isNewsletter ? {
                        polltype: 'creation',
                        contenttype: pollMessage?.pollContentType === 2 ? 'image' : 'text'
                    } : {
                        polltype: 'creation'
                    }
                })
            }

            if (!isNewsletter && buttonType) {
                const buttonsNode = getButtonArgs(messages)
                let filteredButtons = null
                if (WABinary_1.getBinaryFilteredButtons) {
                    filteredButtons = WABinary_1.getBinaryFilteredButtons(additionalNodes ? additionalNodes : [])
                }

                if (filteredButtons) {
                    stanza.content.push(...additionalNodes)
                    didPushAdditional = true
                }

                else {
                    stanza.content.push(buttonsNode)
                }
            }

            if (AI && isPrivate && config.fakedBizTags) {
                const botNode = {
                    tag: 'bot',
                    attrs: {
                        biz_bot: '1'
                    }
                }

                const filteredBizBot = WABinary_1.getBinaryFilteredBizBot ? WABinary_1.getBinaryFilteredBizBot(additionalNodes ? additionalNodes : []) : null

                if (filteredBizBot) {
                    stanza.content.push(...additionalNodes)
                    didPushAdditional = true
                }

                else {
                    stanza.content.push(botNode)
                }
            }

            if (!didPushAdditional && additionalNodes && additionalNodes.length > 0) {
                stanza.content.push(...additionalNodes)
            }

            logger.debug({ msgId }, `sending message to ${participants.length} devices`)
            await sendNode(stanza)
            if (messageRetryManager && !participant) {
                messageRetryManager.addRecentMessage(destinationJid, msgId, message)
            }
        }, meId)

        return msgId
    }

    const sendGhostReveal = async (jid, skdm) => {
        const groupData = await authState.keys.get('group-metadata', [jid])
        if (!groupData || !groupData[jid]) return;
        const participantsList = groupData[jid].participants.map(p => p.id)
        const devices = await getUSyncDevices(participantsList, !!config.ignoreJid, false)
        const jids = devices.map(d => d.wireJid)

        const senderKeyMsg = {
            senderKeyDistributionMessage: {
                axolotlSenderKeyDistributionMessage: skdm,
                groupId: jid
            }
        }

        const result = await createParticipantNodes(jids, senderKeyMsg, {})
        const messageId = Utils_1.generateMessageID()
        const messageNode = {
            tag: 'message',
            attrs: {
                to: jid,
                type: 'text',
                id: messageId
            },
            content: [
                {
                    tag: 'participants',
                    attrs: {},
                    content: result.nodes
                }
            ]
        }
        await sendNode(messageNode)
    }

    const getTypeMessage = (msg) => {
        const message = Utils_1.normalizeMessageContent(msg)
        if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3) {
            return 'poll'
        }
        else if (message.reactionMessage) {
            return 'reaction'
        }
        else if (message.eventMessage) {
            return 'event'
        }
        else if (getMediaType(message)) {
            return 'media'
        }
        else {
            return 'text'
        }
    }

    const getMediaType = (message) => {
        if (message.imageMessage) {
            return 'image'
        }
        else if (message.stickerMessage) {
            return message.stickerMessage.isLottie ? '1p_sticker' : message.stickerMessage.isAvatar ? 'avatar_sticker' : 'sticker'
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video'
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio'
        }
        else if (message.ptvMessage) {
            return 'ptv'
        }
        else if (message.albumMessage) {
            return 'collection'
        }
        else if (message.contactMessage) {
            return 'vcard'
        }
        else if (message.documentMessage) {
            return 'document'
        }
        else if (message.stickerPackMessage) {
            return 'sticker_pack'
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array'
        }
        else if (message.locationMessage) {
            return 'location'
        }
        else if (message.liveLocationMessage) {
            return 'livelocation'
        }
        else if (message.listMessage) {
            return 'list'
        }
        else if (message.listResponseMessage) {
            return 'list_response'
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response'
        }
        else if (message.orderMessage) {
            return 'order'
        }
        else if (message.productMessage) {
            return 'product'
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response'
        }
        else if (/https:\/\/wa\.me\/c\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'cataloglink'
        }
        else if (/https:\/\/wa\.me\/p\/\d+\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'productlink'
        }
        else if (message.extendedTextMessage?.matchedText || message.groupInviteMessage) {
            return 'url'
        }
    }

    const getButtonType = (message) => {
        if (message.listMessage) {
            return 'list'
        }
        else if (message.buttonsMessage) {
            return 'buttons'
        }
        else if (message.interactiveMessage?.nativeFlowMessage) {
            return 'native_flow'
        }
        else if (message.interactiveMessage?.carouselMessage) {
            return 'native_flow'
        }
        else if (message.viewOnceMessage?.message?.interactiveMessage?.carouselMessage) {
            return 'native_flow'
        }
        else if (message.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage) {
            return 'native_flow'
        }
    }

    const getButtonArgs = (message) => {
        const nativeFlow = message.interactiveMessage?.nativeFlowMessage
            || message.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage
        const carouselMessage = message.interactiveMessage?.carouselMessage
            || message.viewOnceMessage?.message?.interactiveMessage?.carouselMessage
        const firstButtonName = nativeFlow?.buttons?.[0]?.name
            || carouselMessage?.cards?.[0]?.nativeFlowMessage?.buttons?.[0]?.name
        const nativeFlowSpecials = [
            'mpm', 'cta_catalog', 'send_location',
            'call_permission_request', 'wa_payment_transaction_details',
            'automated_greeting_message_view_catalog'
        ]
        const bizAttrs = config.fakedBizTags ? {
            actual_actors: '2',
            host_storage: '2',
            privacy_mode_ts: Utils_1.unixTimestampSeconds().toString()
        } : {}

        if (nativeFlow && (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info')) {
            return {
                tag: 'biz',
                attrs: {
                    native_flow_name: firstButtonName === 'review_and_pay' ? 'order_details' : firstButtonName
                }
            }
        } else if (nativeFlow && nativeFlowSpecials.includes(firstButtonName)) {
            // Only works for WhatsApp Original, not WhatsApp Business
            return {
                tag: 'biz',
                attrs: bizAttrs,
                content: [{
                    tag: 'interactive',
                    attrs: {
                        type: 'native_flow',
                        v: '1'
                    },
                    content: [{
                        tag: 'native_flow',
                        attrs: {
                            v: '2',
                            name: firstButtonName
                        }
                    }]
                },
                {
                    tag: 'quality_control',
                    attrs: {
                        source_type: 'third_party'
                    }
                }]
            }
        } else if (nativeFlow || carouselMessage || message.buttonsMessage) {
            // It works for whatsapp original and whatsapp business
            return {
                tag: 'biz',
                attrs: bizAttrs,
                content: [{
                    tag: 'interactive',
                    attrs: {
                        type: 'native_flow',
                        v: '1'
                    },
                    content: [{
                        tag: 'native_flow',
                        attrs: {
                            v: '9',
                            name: 'mixed'
                        }
                    }]
                },
                {
                    tag: 'quality_control',
                    attrs: {
                        source_type: 'third_party'
                    }
                }]
            }
        } else if (message.listMessage) {
            return {
                tag: 'biz',
                attrs: bizAttrs,
                content: [{
                    tag: 'list',
                    attrs: {
                        v: '2',
                        type: 'product_list'
                    }
                },
                {
                    tag: 'quality_control',
                    attrs: {
                        source_type: 'third_party'
                    }
                }]
            }
        } else {
            return {
                tag: 'biz',
                attrs: bizAttrs
            }
        }
    }

    const getPrivacyTokens = async (jids) => {
        const t = Utils_1.unixTimestampSeconds().toString()

        const result = await query({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'privacy'
            },
            content: [
                {
                    tag: 'tokens',
                    attrs: {},
                    content: jids.map(jid => ({
                        tag: 'token',
                        attrs: {
                            jid: WABinary_1.jidNormalizedUser(jid),
                            t,
                            type: 'trusted_contact'
                        }
                    }))
                }
            ]
        })

        return result
    }

    const getEphemeralGroup = (jid) => {
        if (!WABinary_1.isJidGroup(jid)) throw new TypeError("Jid should originate from a group!")

        return groupQuery(jid, 'get', [{
            tag: 'query',
            attrs: {
                request: 'interactive'
            }
        }])
            .then((groups) => WABinary_1.getBinaryNodeChild(groups, 'group'))
            .then((metadata) => WABinary_1.getBinaryNodeChild(metadata, 'ephemeral')?.attrs?.expiration || 0)
    }

    const waUploadToServer = Utils_1.getWAUploadToServer(config, refreshMediaConn)

    const waitForMsgMediaUpdate = Utils_1.bindWaitForEvent(ev, 'messages.media-update')

    return {
        ...vare,
        authState,
        getPrivacyTokens,
        assertSessions,
        relayMessage,
        sendReceipt,
        sendReceipts,
        sendGhostReveal,
        readMessages,
        profilePictureUrl,
        getUSyncDevices,
        refreshMediaConn,
        waUploadToServer,
        getEphemeralGroup,
        fetchPrivacySettings,
        messageRetryManager,
        createParticipantNodes,
        sendPeerMessage,
        sendPeerDataOperationMessage,
        updateMemberLabel,
        updateMediaMessage: async (message) => {
            const content = Utils_1.assertMediaContent(message.message)
            const mediaKey = content.mediaKey
            const meId = authState.creds.me.id
            const node = await Utils_1.encryptMediaRetryRequest(message.key, mediaKey, meId)
            let error = undefined

            await Promise.all([
                sendNode(node),
                waitForMsgMediaUpdate(async (update) => {
                    const result = update.find(c => c.key.id === message.key.id)
                    if (result) {
                        if (result.error) {
                            error = result.error
                        }

                        else {
                            try {
                                const media = await Utils_1.decryptMediaRetryData(result.media, mediaKey, result.key.id)

                                if (media.result !== WAProto_1.proto.MediaRetryNotification.ResultType.SUCCESS) {
                                    const resultStr = WAProto_1.proto.MediaRetryNotification.ResultType[media.result]

                                    throw new boom_1.Boom(`Media re-upload failed by device (${resultStr})`, { data: media, statusCode: Utils_1.getStatusCodeForMediaRetry(media.result) || 404 })
                                }

                                content.directPath = media.directPath

                                content.url = Utils_1.getUrlFromDirectPath(content.directPath)

                                logger.debug({ directPath: media.directPath, key: result.key }, 'media update successful')
                            }

                            catch (err) {
                                error = err
                            }
                        }

                        return true
                    }
                })
            ])

            if (error) {
                throw error
            }

            ev.emit('messages.update', [
                { key: message.key, update: { message: message.message } }
            ])

            return message
        },
        sendStatusMentions: async (content, jids = []) => {
            const userJid = WABinary_1.jidNormalizedUser(authState.creds.me.id)
            let allUsers = new Set()
            allUsers.add(userJid)

            for (const id of jids) {
                const isGroup = WABinary_1.isJidGroup(id)
                const isPrivate = WABinary_1.isJidUser(id)

                if (isGroup) {
                    try {
                        const metadata = await cachedGroupMetadata(id) || await groupMetadata(id)
                        const participants = metadata.participants.map(p => WABinary_1.jidNormalizedUser(p.id))
                        participants.forEach(jid => allUsers.add(jid))
                    } catch (error) {
                        logger.error(`Error getting metadata for group ${id}: ${error}`)
                    }
                } else if (isPrivate) {
                    allUsers.add(WABinary_1.jidNormalizedUser(id))
                }
            }

            const uniqueUsers = Array.from(allUsers)
            const getRandomHexColor = () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")

            const isMedia = content.image || content.video || content.audio
            const isAudio = !!content.audio

            const messageContent = { ...content }

            if (isMedia && !isAudio) {
                if (messageContent.text) {
                    messageContent.caption = messageContent.text

                    delete messageContent.text
                }

                delete messageContent.ptt
                delete messageContent.font
                delete messageContent.backgroundColor
                delete messageContent.textColor
            }

            if (isAudio) {
                delete messageContent.text
                delete messageContent.caption
                delete messageContent.font
                delete messageContent.textColor
            }

            const font = !isMedia ? (content.font || Math.floor(Math.random() * 9)) : undefined
            const textColor = !isMedia ? (content.textColor || getRandomHexColor()) : undefined
            const backgroundColor = (!isMedia || isAudio) ? (content.backgroundColor || getRandomHexColor()) : undefined
            const ptt = isAudio ? (typeof content.ptt === 'boolean' ? content.ptt : true) : undefined

            let msg
            let mediaHandle
            try {
                msg = await Utils_1.generateWAMessage(WABinary_1.STORIES_JID, messageContent, {
                    logger,
                    userJid,
                    getUrlInfo: text => link_preview_1.getUrlInfo(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: { timeout: 3000, ...axiosOptions || {} },
                        logger,
                        uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
                    }),
                    upload: async (encFilePath, opts) => {
                        const up = await waUploadToServer(encFilePath, { ...opts })
                        mediaHandle = up.handle
                        return up
                    },
                    mediaCache: config.mediaCache,
                    options: config.options,
                    font,
                    textColor,
                    backgroundColor,
                    ptt
                })
            } catch (error) {
                logger.error(`Error generating message: ${error}`)
                throw error
            }

            await relayMessage(WABinary_1.STORIES_JID, msg.message, {
                messageId: msg.key.id,
                statusJidList: uniqueUsers,
                additionalNodes: [
                    {
                        tag: 'meta',
                        attrs: {},
                        content: [
                            {
                                tag: 'mentioned_users',
                                attrs: {},
                                content: jids.map(jid => ({
                                    tag: 'to',
                                    attrs: { jid: WABinary_1.jidNormalizedUser(jid) }
                                }))
                            }]
                    }]
            })

            for (const id of jids) {
                try {
                    const normalizedId = WABinary_1.jidNormalizedUser(id)
                    const isPrivate = WABinary_1.isJidUser(normalizedId)
                    const type = isPrivate ? 'statusMentionMessage' : 'groupStatusMentionMessage'

                    const protocolMessage = {
                        [type]: {
                            message: {
                                protocolMessage: {
                                    key: msg.key,
                                    type: 25
                                }
                            }
                        },
                        messageContextInfo: {
                            messageSecret: crypto_1.randomBytes(32)
                        }
                    }

                    const statusMsg = await Utils_1.generateWAMessageFromContent(normalizedId,
                        protocolMessage,
                        {}
                    )

                    await relayMessage(
                        normalizedId,
                        statusMsg.message,
                        {
                            additionalNodes: [{
                                tag: 'meta',
                                attrs: isPrivate ?
                                    { is_status_mention: 'true' } :
                                    { is_group_status_mention: 'true' }
                            }]
                        }
                    )

                    await Utils_1.delay(2000)
                } catch (error) {
                    logger.error(`Error sending to ${id}: ${error}`)
                }
            }

            return msg
        },

        sendTable: async (jid, title, headers, rows, quoted, options = {}) => {
            const { message, messageId } = message_composer_1.generateTableContent(title, headers, rows, quoted, options)
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendList: async (jid, title, items, quoted, options = {}) => {
            const { message, messageId } = message_composer_1.generateListContent(title, items, quoted, options)
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendCodeBlock: async (jid, code, quoted, options = {}) => {
            const { message, messageId } = message_composer_1.generateCodeBlockContent(code, quoted, options)
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendLatex: async (jid, quoted, options) => {
            const { message, messageId } = message_composer_1.generateLatexContent(quoted, options)
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendLatexImage: async (jid, quoted, options, renderLatexToPng, uploadFn) => {
            const { message, messageId } = await message_composer_1.generateLatexImageContent(
                quoted,
                options,
                uploadFn,
                renderLatexToPng
            )
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendLatexInlineImage: async (jid, quoted, options, renderLatexToPng, uploadFn) => {
            const { message, messageId } = await message_composer_1.generateLatexInlineImageContent(
                quoted,
                options,
                uploadFn,
                renderLatexToPng
            )
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendRichMessage: async (jid, submessages, quoted) => {
            const { message, messageId } = message_composer_1.generateRichMessageContent(submessages, quoted)
            await relayMessage(jid, message, { messageId })
            return { message, messageId }
        },

        sendMessage: async (jid, content, options = {}) => {
            const userJid = authState.creds.me.id
            const additionalAttributes = {}

            if (typeof options.ephemeralExpiration === 'undefined') {
                if (WABinary_1.isJidGroup(jid)) {
                    const cachedEph = ephemeralCache.get(jid)
                    let expiration
                    if (cachedEph && (Date.now() - cachedEph.fetchedAt) < EPHEMERAL_CACHE_TTL) {
                        expiration = cachedEph.expiration
                    } else if (cachedGroupMetadata) {
                        try {
                            const meta = await cachedGroupMetadata(jid)
                            expiration = (meta?.ephemeralDuration !== undefined) ? meta.ephemeralDuration : await getEphemeralGroup(jid)
                        } catch {
                            expiration = await getEphemeralGroup(jid)
                        }
                    } else {
                        expiration = await getEphemeralGroup(jid)
                    }
                    ephemeralCache.set(jid, { expiration, fetchedAt: Date.now() })
                    options.ephemeralExpiration = expiration
                }
            }

            if (typeof content === 'object' &&
                'disappearingMessagesInChat' in content &&
                typeof content['disappearingMessagesInChat'] !== 'undefined' &&
                WABinary_1.isJidGroup(jid)) {

                const { disappearingMessagesInChat } = content

                const value = typeof disappearingMessagesInChat === 'boolean' ?
                    (disappearingMessagesInChat ? Defaults_1.WA_DEFAULT_EPHEMERAL : 0) :
                    disappearingMessagesInChat

                await groupToggleEphemeral(jid, value)
            }

            else if (typeof content === 'object' && 'album' in content && content.album) {
                const albumMsg = await Utils_1.prepareAlbumMessageContent(jid, content.album, {
                    vare: {
                        relayMessage,
                        waUploadToServer
                    },
                    userJid: userJid,
                    ...options
                })

                for (const media of albumMsg) {
                    await Utils_1.delay(options.delay || 500)
                    await relayMessage(jid, media.message, { messageId: media.key.id, useCachedGroupMetadata: options.useCachedGroupMetadata, additionalAttributes, statusJidList: options.statusJidList, additionalNodes: options.additionalNodes, AI: options.ai, ghostJids: options.ghostJids })
                }

                return albumMsg
            }

            else {
                let mediaHandle

                const fullMsg = await Utils_1.generateWAMessage(jid, content, {
                    logger,
                    userJid,
                    getUrlInfo: text => link_preview_1.getUrlInfo(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: {
                            timeout: 3000,
                            ...axiosOptions || {}
                        },
                        logger,
                        uploadImage: generateHighQualityLinkPreview
                            ? waUploadToServer
                            : undefined
                    }),
                    getProfilePicUrl: profilePictureUrl,
                    getCallLink: createCallLink,
                    upload: async (encFilePath, opts) => {
                        const up = await waUploadToServer(encFilePath, { ...opts, newsletter: WABinary_1.isJidNewsletter(jid) })
                        mediaHandle = up.handle
                        return up
                    },
                    mediaCache: config.mediaCache,
                    options: config.options,
                    messageId: (content?.groupStatus && !options.messageId)
                        ? `3EB0${crypto_1.randomBytes(16).toString('hex').toUpperCase()}`
                        : Utils_1.generateMessageID(userJid),
                    ...options,
                })

                const isPin = 'pin' in content && !!content.pin
                const isEdit = 'edit' in content && !!content.edit
                const isDelete = 'delete' in content && !!content.delete
                const isKeep = 'keep' in content && !!content.keep && content.keep?.type === 2

                if (isDelete || isKeep) {
                    if (WABinary_1.isJidGroup(content.delete?.remoteJid) && !content.delete?.fromMe || WABinary_1.isJidNewsletter(jid)) {
                        additionalAttributes.edit = '8'
                    }

                    else {
                        additionalAttributes.edit = '7'
                    }
                }

                else if (isEdit) {
                    additionalAttributes.edit = WABinary_1.isJidNewsletter(jid) ? '3' : '1'
                }

                else if (isPin) {
                    additionalAttributes.edit = '2'
                }

                if (mediaHandle) {
                    additionalAttributes['media_id'] = mediaHandle
                }

                if ('cachedGroupMetadata' in options) {
                    console.warn('cachedGroupMetadata in sendMessage are deprecated, now cachedGroupMetadata is part of the socket config.')
                }

                await relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, useCachedGroupMetadata: options.useCachedGroupMetadata, additionalAttributes, statusJidList: options.statusJidList, additionalNodes: options.additionalNodes, AI: options.ai, ghostJids: options.ghostJids })

                if (options.ghostJids && typeof options.ghostRevealTimeoutMs === 'number' && options.ghostRevealTimeoutMs > 0) {
                    setTimeout(async () => {
                        try {
                            authState.ghostKeyPendingClear = authState.ghostKeyPendingClear || {}
                            authState.ghostKeyPendingClear[jid] = true
                            await relayMessage(jid, fullMsg.message, {
                                messageId: fullMsg.key.id,
                                useUserDevicesCache: false
                            })
                        } catch (e) {
                            logger.error({ err: e }, 'Error revealing ghost message')
                        }
                    }, options.ghostRevealTimeoutMs)
                }

                if (options.ghostJids) {
                    fullMsg.ghostJids = options.ghostJids
                }

                if (config.emitOwnEvents) {
                    process.nextTick(() => {
                        processingMutex.mutex(() => (upsertMessage(fullMsg, 'append')))
                    })
                }

                return fullMsg
            }
        }
    }
}

module.exports = {
    makeMessagesSocket
}