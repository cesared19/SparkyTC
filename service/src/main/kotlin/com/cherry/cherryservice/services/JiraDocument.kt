package com.cherry.cherryservice.services

/**
 * Minimal builder for Atlassian Document Format, the rich text format used by Jira Cloud descriptions.
 */
class JiraDocument {
    private val content = mutableListOf<Map<String, Any>>()

    fun heading(text: String): JiraDocument {
        content.add(mapOf(
            "type" to "heading",
            "attrs" to mapOf("level" to 3),
            "content" to listOf(textNode(text))
        ))
        return this
    }

    /** Adds a paragraph, keeping the line breaks of the original text. */
    fun paragraph(text: String): JiraDocument {
        val lines = text.trim().lines()
        val nodes = mutableListOf<Map<String, Any>>()
        for ((index, line) in lines.withIndex()) {
            if (index > 0) nodes.add(mapOf("type" to "hardBreak"))
            if (line.isNotEmpty()) nodes.add(textNode(line))
        }
        content.add(mapOf("type" to "paragraph", "content" to nodes))
        return this
    }

    fun links(links: List<Pair<String, String>>): JiraDocument {
        if (links.isEmpty()) return this
        content.add(mapOf(
            "type" to "bulletList",
            "content" to links.map { (title, url) ->
                mapOf(
                    "type" to "listItem",
                    "content" to listOf(mapOf("type" to "paragraph", "content" to listOf(linkNode(title, url))))
                )
            }
        ))
        return this
    }

    fun build(): Map<String, Any> {
        return mapOf("type" to "doc", "version" to 1, "content" to content)
    }

    private fun textNode(text: String): Map<String, Any> = mapOf("type" to "text", "text" to text)

    private fun linkNode(text: String, url: String): Map<String, Any> = mapOf(
        "type" to "text",
        "text" to text,
        "marks" to listOf(mapOf("type" to "link", "attrs" to mapOf("href" to url)))
    )
}
