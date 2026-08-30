"use strict"

const { proto } = require("../../WAProto")
const { generateMessageID } = require("./generics")

const JS_KEYWORDS = new Set([
    'import', 'export', 'from', 'default', 'as',
    'const', 'let', 'var',
    'function', 'class', 'extends',
    'new', 'return',
    'if', 'else',
    'for', 'while', 'do',
    'switch', 'case', 'break', 'continue',
    'try', 'catch', 'finally', 'throw',
    'async', 'await', 'yield',
    'typeof', 'instanceof', 'in', 'of',
    'delete', 'void',
    'true', 'false', 'null', 'undefined',
    'NaN', 'Infinity',
    'this', 'super', 'static', 'get', 'set',
    'debugger', 'with'
])

const PYTHON_KEYWORDS = new Set([
    'import', 'from', 'as',
    'def', 'class', 'return',
    'if', 'elif', 'else',
    'for', 'while', 'break', 'continue',
    'try', 'except', 'finally', 'raise',
    'with', 'yield', 'lambda', 'pass',
    'del', 'global', 'nonlocal', 'assert',
    'True', 'False', 'None',
    'and', 'or', 'not', 'in', 'is',
    'async', 'await', 'self', 'print'
])

const LANGUAGE_KEYWORDS = {
    javascript: JS_KEYWORDS,
    typescript: JS_KEYWORDS,
    js: JS_KEYWORDS,
    ts: JS_KEYWORDS,
    python: PYTHON_KEYWORDS,
    py: PYTHON_KEYWORDS
}

const CodeHighlightType = {
    DEFAULT: 0,
    KEYWORD: 1,
    METHOD: 2,
    STRING: 3,
    NUMBER: 4,
    COMMENT: 5
}

CodeHighlightType[0] = 'DEFAULT'
CodeHighlightType[1] = 'KEYWORD'
CodeHighlightType[2] = 'METHOD'
CodeHighlightType[3] = 'STRING'
CodeHighlightType[4] = 'NUMBER'
CodeHighlightType[5] = 'COMMENT'

const RichSubMessageType = {
    UNKNOWN: 0,
    GRID_IMAGE: 1,
    TEXT: 2,
    INLINE_IMAGE: 3,
    TABLE: 4,
    CODE: 5,
    DYNAMIC: 6,
    MAP: 7,
    LATEX: 8,
    CONTENT_ITEMS: 9
}

const tokenizeCode = (codeStr, language = 'javascript') => {
    const keywords = LANGUAGE_KEYWORDS[language] || JS_KEYWORDS
    const blocks = []
    const lines = codeStr.split('\n')

    for (let li = 0; li < lines.length; li++) {
        const line = lines[li]
        const isLast = li === lines.length - 1
        const nl = isLast ? '' : '\n'

        if (!line.trim()) {
            blocks.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: line + nl })
            continue
        }

        if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
            blocks.push({ highlightType: CodeHighlightType.COMMENT, codeContent: line + nl })
            continue
        } // i could never lose, what u thought?

        const regex =
            /(\/\/.*$|#.*$)|(\"(?:[^\"\\]|\\.)*\")|('(?:[^'\\]|\\.)*')|(`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|([^\s\w$\"'`]+)|(\s+)/g

        let match
        const tokens = []

        while ((match = regex.exec(line)) !== null) {
            const val = match[0]

            if (match[1]) {
                tokens.push({ highlightType: CodeHighlightType.COMMENT, codeContent: val })
            } else if (match[2] || match[3] || match[4]) {
                tokens.push({ highlightType: CodeHighlightType.STRING, codeContent: val })
            } else if (match[5]) {
                tokens.push({ highlightType: CodeHighlightType.NUMBER, codeContent: val })
            } else if (match[6]) {
                if (keywords.has(val)) {
                    tokens.push({ highlightType: CodeHighlightType.KEYWORD, codeContent: val })
                } else {
                    const after = line.slice(regex.lastIndex).trimStart()
                    if (after.startsWith('(')) {
                        tokens.push({ highlightType: CodeHighlightType.METHOD, codeContent: val })
                    } else {
                        tokens.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: val })
                    }
                }
            } else {
                tokens.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: val })
            }
        }

        if (tokens.length === 0) {
            blocks.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: line + nl })
            continue
        }

        const merged = []
        for (const t of tokens) {
            const prev = merged.length > 0 ? merged[merged.length - 1] : undefined
            if (prev && prev.highlightType === t.highlightType) {
                prev.codeContent += t.codeContent
            } else {
                merged.push({ ...t })
            }
        }

        if (merged.length > 0) {
            merged[merged.length - 1].codeContent += nl
        }

        blocks.push(...merged)
    }

    return blocks
}

const buildRichContextInfo = (quoted) => {
    const ctxInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
        forwardOrigin: 4
    }

    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid
        ctxInfo.quotedMessage = quoted.message
    }

    return ctxInfo
}

const buildBotForwardedMessage = (submessages, contextInfo, unifiedResponse) => {
    const richResponse = {
        messageType: 1,
        submessages,
        contextInfo
    }

    if (unifiedResponse) {
        richResponse.unifiedResponse = unifiedResponse
    }

    return {
        botForwardedMessage: {
            message: {
                richResponseMessage: richResponse
            }
        }
    }
}

const generateTableContent = (title, headers, rows, quoted, options = {}) => {
    const { footer, headerText } = options
    const tableRows = [
        { items: headers, isHeading: true },
        ...rows.map(row => ({ items: row.map(String) }))
    ]

    const submessages = []
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText })
    }
    submessages.push({ messageType: 4, tableMetadata: { title, rows: tableRows } })
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const generateListContent = (title, items, quoted, options = {}) => {
    const { footer, headerText } = options
    const tableRows = items.map(item => ({
        items: Array.isArray(item) ? item.map(String) : [String(item)]
    }))

    const submessages = []
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText })
    }
    submessages.push({ messageType: 4, tableMetadata: { title, rows: tableRows } })
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const generateCodeBlockContent = (code, quoted, options = {}) => {
    const { title, footer, language = 'javascript' } = options
    const submessages = []

    if (title) {
        submessages.push({ messageType: 2, messageText: title })
    }
    submessages.push({
        messageType: 5,
        codeMetadata: {
            codeLanguage: language,
            codeBlocks: tokenizeCode(code, language)
        }
    })
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const generateLatexContent = (quoted, options) => {
    const { text, expressions, headerText, footer } = options
    const submessages = []

    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText })
    }

    const latexExpressions = expressions.map(expr => {
        const entry = {
            latexExpression: expr.latexExpression,
            url: expr.url,
            width: expr.width,
            height: expr.height
        }
        if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight
        if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding
        if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding
        if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding
        if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding
        return entry
    })

    submessages.push({ messageType: 8, latexMetadata: { text: text || '', expressions: latexExpressions } })
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options
    const submessages = []

    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText })
    }

    const latexExpressions = await Promise.all(
        expressions.map(async expr => {
            const { buffer, width, height } = await renderLatexToPng(expr.latexExpression)
            const uploadResult = await uploadFn(buffer, 'image')
            const imageUrl = uploadResult.url || uploadResult.directPath
            return { latexExpression: expr.latexExpression, url: imageUrl, width, height }
        })
    )

    submessages.push({ messageType: 8, latexMetadata: { text: text || '', expressions: latexExpressions } })
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options
    const submessages = []

    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText })
    }
    if (text) {
        submessages.push({ messageType: 2, messageText: text })
    }

    for (const expr of expressions) {
        const { buffer, width, height } = await renderLatexToPng(expr.latexExpression)
        const uploadResult = await uploadFn(buffer, 'image')
        const imageUrl = uploadResult.url || uploadResult.directPath
        submessages.push({
            messageType: 3,
            imageMetadata: {
                imageUrl: {
                    imagePreviewUrl: imageUrl,
                    imageHighResUrl: imageUrl
                },
                imageText: expr.latexExpression,
                alignment: 2
            }
        })
    }

    if (footer) {
        submessages.push({ messageType: 2, messageText: footer })
    }

    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

const captureUnifiedResponse = (msg) => {
    const botFwd = msg?.botForwardedMessage?.message
    if (!botFwd) return null
    const rich = botFwd.richResponseMessage
    if (!rich?.unifiedResponse?.data) return null
    return {
        unifiedResponse: { data: rich.unifiedResponse.data },
        submessages: rich.submessages || [],
        contextInfo: rich.contextInfo || {}
    }
}

const generateUnifiedResponseContent = (quoted, captured) => {
    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(captured.submessages, ctxInfo, captured.unifiedResponse),
        messageId: generateMessageID()
    }
}

const generateRichMessageContent = (submessages, quoted) => {
    const ctxInfo = buildRichContextInfo(quoted)
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageID()
    }
}

module.exports = {
    JS_KEYWORDS,
    PYTHON_KEYWORDS,
    LANGUAGE_KEYWORDS,
    CodeHighlightType,
    RichSubMessageType,
    tokenizeCode,
    buildRichContextInfo,
    buildBotForwardedMessage,
    generateTableContent,
    generateListContent,
    generateCodeBlockContent,
    generateLatexContent,
    generateLatexImageContent,
    generateLatexInlineImageContent,
    captureUnifiedResponse,
    generateUnifiedResponseContent,
    generateRichMessageContent
}