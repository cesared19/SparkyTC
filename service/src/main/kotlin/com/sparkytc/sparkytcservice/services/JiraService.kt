package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.jira.JiraConfigurationDTO
import com.sparkytc.sparkytcservice.dto.jira.JiraIssueDTO
import com.sparkytc.sparkytcservice.dto.jira.SimilarJiraIssueDTO
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.commons.logging.Log
import org.apache.commons.logging.LogFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import java.util.Base64

/**
 * Thin client for the Jira Cloud REST API v3. Files are intentionally never uploaded to Jira,
 * issues only link back to the attachments stored in SparkyTC, so the Jira storage quota is not used.
 */
@Service
class JiraService(
    @Value("\${sparkytc.jira.base-url:}")
    baseURL: String,

    @Value("\${sparkytc.jira.email:}")
    private val email: String,

    @Value("\${sparkytc.jira.api-token:}")
    private val apiToken: String,

    @Value("\${sparkytc.jira.project-key:SCRUM}")
    private val projectKey: String,

    @Value("\${sparkytc.jira.issue-type:Error}")
    private val issueType: String,

    private val objectMapper: ObjectMapper,
) {
    private val log: Log = LogFactory.getLog(javaClass)

    private val baseURL = baseURL.trim().trimEnd('/')

    val isEnabled: Boolean
        get() = baseURL.isNotBlank() && email.isNotBlank() && apiToken.isNotBlank()

    private val restClient: RestClient by lazy {
        val credentials = Base64.getEncoder().encodeToString("$email:$apiToken".toByteArray())
        RestClient.builder()
            .baseUrl(baseURL)
            .defaultHeader("Authorization", "Basic $credentials")
            .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
            .build()
    }

    fun configuration(): JiraConfigurationDTO {
        return if (isEnabled) {
            JiraConfigurationDTO(true, baseURL, projectKey, issueType)
        } else {
            JiraConfigurationDTO(false, null, null, null)
        }
    }

    fun issueURL(issueKey: String): String = "$baseURL/browse/$issueKey"

    /** The Jira project used when a SparkyTC project doesn't choose one. */
    val defaultProjectKey: String
        get() = projectKey

    /** Creates an issue in the given project (or the default one) and returns its key. */
    fun createIssue(summary: String, description: Map<String, Any>, targetProjectKey: String? = null): String {
        requireEnabled()

        val body = mapOf(
            "fields" to mapOf(
                "project" to mapOf("key" to (targetProjectKey ?: projectKey)),
                "issuetype" to mapOf("name" to issueType),
                "summary" to summary,
                "description" to description,
            )
        )

        val response = call("create the Jira issue") {
            restClient.post()
                .uri("/rest/api/3/issue")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode::class.java)
        }

        return response?.get("key")?.asText() ?: throw IllegalArgumentException("Jira did not return the created issue key")
    }

    /** Adds a link in the Jira issue that points back to SparkyTC. Failures are logged but not fatal. */
    fun addRemoteLink(issueKey: String, url: String, title: String) {
        if (!isEnabled) return

        try {
            restClient.post()
                .uri("/rest/api/3/issue/{key}/remotelink", issueKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf(
                    // a stable global id keeps jira from duplicating the link if it is added twice
                    "globalId" to "sparkytc=$url",
                    "object" to mapOf("url" to url, "title" to title)
                ))
                .retrieve()
                .toBodilessEntity()
        } catch (e: RestClientException) {
            log.warn("Unable to add SparkyTC link to Jira issue $issueKey", e)
        }
    }

    /** Throws a validation error when the Jira project doesn't exist or the account can't see it. */
    fun requireProject(key: String) {
        requireEnabled()
        call("find Jira project $key") {
            restClient.get()
                .uri("/rest/api/3/project/{key}", key)
                .retrieve()
                .toBodilessEntity()
        }
    }

    /**
     * Finds existing issues whose summary resembles the given one. Jira returns issues sharing any
     * significant word, and they are ranked here by how many words the summaries have in common.
     */
    fun searchSimilar(summary: String, targetProjectKey: String? = null, limit: Int = 5): List<SimilarJiraIssueDTO> {
        requireEnabled()

        val words = significantWords(summary)
        if (words.isEmpty()) return emptyList()

        // words only contain letters and digits, so they are safe inside the JQL string
        val wordClauses = words.sortedByDescending { it.length }.take(MAX_SEARCH_WORDS).joinToString(" OR ") { "summary ~ \"$it\"" }
        val jql = "project = \"${targetProjectKey ?: projectKey}\" AND ($wordClauses) ORDER BY updated DESC"

        val response = call("search Jira for similar issues") {
            restClient.post()
                .uri("/rest/api/3/search/jql")
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("jql" to jql, "maxResults" to SIMILAR_CANDIDATES, "fields" to listOf("summary", "status")))
                .retrieve()
                .body(JsonNode::class.java)
        }

        return response?.get("issues")?.toList().orEmpty().mapNotNull { issue ->
            val key = issue.get("key")?.asText() ?: return@mapNotNull null
            val fields = issue.get("fields")
            val issueSummary = fields?.get("summary")?.asText() ?: return@mapNotNull null
            val issueWords = significantWords(issueSummary)
            val union = (words + issueWords).size
            val similarity = if (union == 0) 0.0 else words.intersect(issueWords).size.toDouble() / union
            SimilarJiraIssueDTO(
                issueKey = key,
                issueURL = issueURL(key),
                summary = issueSummary,
                status = fields.get("status")?.get("name")?.asText(),
                statusCategory = fields.get("status")?.get("statusCategory")?.get("key")?.asText(),
                similarity = similarity,
            )
        }
            .filter { it.similarity >= MINIMUM_SIMILARITY }
            .sortedByDescending { it.similarity }
            .take(limit)
    }

    /** Fetches an issue, throwing a validation error when it doesn't exist or can't be read. */
    fun retrieveIssue(issueKey: String): JiraIssueDTO {
        requireEnabled()

        val response = call("retrieve Jira issue $issueKey") {
            restClient.get()
                .uri("/rest/api/3/issue/{key}?fields=summary,status", issueKey)
                .retrieve()
                .body(JsonNode::class.java)
        }

        val fields = response?.get("fields")
        val status = fields?.get("status")
        return JiraIssueDTO(
            issueKey = response?.get("key")?.asText() ?: issueKey,
            issueURL = issueURL(response?.get("key")?.asText() ?: issueKey),
            summary = fields?.get("summary")?.asText(),
            status = status?.get("name")?.asText(),
            statusCategory = status?.get("statusCategory")?.get("key")?.asText(),
        )
    }

    /** Fetches the status of several issues, reporting per-issue errors instead of failing. */
    fun retrieveIssues(issueKeys: List<String>): List<JiraIssueDTO> {
        return issueKeys.distinct().map { issueKey ->
            try {
                retrieveIssue(issueKey)
            } catch (e: IllegalArgumentException) {
                JiraIssueDTO(issueKey, issueURL(issueKey), null, null, null, e.message)
            }
        }
    }

    private fun requireEnabled() {
        require(isEnabled) { "The Jira integration is not configured. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in the backend service" }
    }

    private fun <T> call(action: String, request: () -> T): T {
        try {
            return request()
        } catch (e: RestClientResponseException) {
            throw IllegalArgumentException("Unable to $action: ${describeError(e.statusCode, e.responseBodyAsString)}", e)
        } catch (e: RestClientException) {
            log.error("Unable to reach Jira", e)
            throw IllegalArgumentException("Unable to $action: Jira could not be reached", e)
        }
    }

    private fun describeError(statusCode: HttpStatusCode, body: String): String {
        when (statusCode.value()) {
            401 -> return "Jira rejected the credentials, check JIRA_EMAIL and JIRA_API_TOKEN (API tokens expire and may need to be renewed)"
            403 -> return "the Jira account doesn't have permission for this action"
            404 -> return "not found in Jira, or the Jira account can't see it"
            429 -> return "Jira rate limit reached, try again in a minute"
        }

        // jira error bodies look like {"errorMessages": [...], "errors": {"field": "message"}}
        val messages = try {
            val json = objectMapper.readTree(body)
            json.get("errorMessages")?.map { it.asText() }.orEmpty() +
                json.get("errors")?.fields()?.asSequence()?.map { "${it.key}: ${it.value.asText()}" }?.toList().orEmpty()
        } catch (e: Exception) {
            emptyList()
        }

        return messages.joinToString("; ").ifBlank { "Jira responded with status ${statusCode.value()}" }
    }

    companion object {
        private const val MAX_SEARCH_WORDS = 8
        private const val SIMILAR_CANDIDATES = 30
        private const val MINIMUM_SIMILARITY = 0.2

        // common words that say nothing about what an issue is about, in english and spanish
        private val STOP_WORDS = setOf(
            "the", "and", "for", "with", "when", "from", "that", "this", "are", "not", "but", "into", "after", "before",
            "los", "las", "del", "con", "para", "por", "una", "uno", "que", "cuando", "como", "sin", "sobre", "entre",
        )

        fun significantWords(text: String): Set<String> {
            return Regex("[\\p{L}\\p{N}]+").findAll(text.lowercase())
                .map { it.value }
                .filter { it.length >= 3 && it !in STOP_WORDS }
                .toSet()
        }

        private val ISSUE_KEY_PATTERN = Regex("[A-Z][A-Z0-9_]+-\\d+")

        /** Extracts an issue key from a key or an issue URL, e.g. https://site.atlassian.net/browse/SCRUM-1 */
        fun parseIssueKey(input: String): String? {
            return ISSUE_KEY_PATTERN.findAll(input.trim().uppercase()).lastOrNull()?.value
        }
    }
}
