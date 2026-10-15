package com.cherry.cherryservice.controllers

import com.cherry.cherryservice.database.DatabaseMigrator
import com.cherry.cherryservice.dto.jira.CreateJiraIssueDTO
import com.cherry.cherryservice.dto.jira.LinkJiraIssueDTO
import com.cherry.cherryservice.dto.projects.CreateWorkspaceProjectDTO
import com.cherry.cherryservice.dto.properties.PropertyConfigurationDTO
import com.cherry.cherryservice.dto.testcases.CreateTestCaseDTO
import com.cherry.cherryservice.dto.testcases.TestCaseDTO
import com.cherry.cherryservice.dto.testruns.CreateTestRunDTO
import com.cherry.cherryservice.dto.testruns.TestCaseRunDTO
import com.cherry.cherryservice.dto.testruns.TestRunDTO
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.sun.net.httpserver.HttpServer
import org.hamcrest.Matchers
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.net.InetSocketAddress
import java.util.Base64
import java.util.Collections
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class JiraIntegrationTests {

    data class RecordedRequest(val method: String, val path: String, val authorization: String?, val body: String)

    companion object {
        @Container
        private val postgresContainer = PostgreSQLContainer<Nothing>("postgres:latest").apply {
            withDatabaseName("testdb")
            withUsername("test")
            withPassword("test")
        }

        private val requests: MutableList<RecordedRequest> = Collections.synchronizedList(mutableListOf())

        // fake jira cloud api
        private val jiraServer: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/") { exchange ->
                val body = exchange.requestBody.readBytes().toString(Charsets.UTF_8)
                val path = exchange.requestURI.path
                requests.add(RecordedRequest(exchange.requestMethod, path, exchange.requestHeaders.getFirst("Authorization"), body))

                val (status, response) = when {
                    exchange.requestMethod == "POST" && path == "/rest/api/3/issue" ->
                        if (body.contains("\"summary\":\"Rejected by Jira\"")) {
                            400 to """{"errorMessages":[],"errors":{"customfield_10010":"Field is required"}}"""
                        } else {
                            201 to """{"id":"10101","key":"SCRUM-101"}"""
                        }
                    exchange.requestMethod == "POST" && path.endsWith("/remotelink") -> 201 to """{"id":1}"""
                    exchange.requestMethod == "GET" && path == "/rest/api/3/issue/SCRUM-7" ->
                        200 to """{"key":"SCRUM-7","fields":{"summary":"Existing bug","status":{"name":"In Progress","statusCategory":{"key":"indeterminate"}}}}"""
                    else -> 404 to """{"errorMessages":["Issue does not exist or you do not have permission to see it."],"errors":{}}"""
                }

                val bytes = response.toByteArray()
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(status, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
            start()
        }

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgresContainer::getJdbcUrl)
            registry.add("spring.datasource.username", postgresContainer::getUsername)
            registry.add("spring.datasource.password", postgresContainer::getPassword)
            registry.add("cherry.jira.base-url") { "http://127.0.0.1:${jiraServer.address.port}" }
            registry.add("cherry.jira.email") { "tester@example.com" }
            registry.add("cherry.jira.api-token") { "secret-token" }
            registry.add("cherry.jira.project-key") { "SCRUM" }
            registry.add("cherry.jira.issue-type") { "Error" }
        }

        @JvmStatic
        @AfterAll
        fun stopJira() {
            jiraServer.stop(0)
        }
    }

    @Autowired
    private lateinit var databaseMigrator: DatabaseMigrator

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    private val jiraBaseURL get() = "http://127.0.0.1:${jiraServer.address.port}"

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        requests.clear()
    }

    @Test
    fun `should report the jira configuration`() {
        mockMvc.perform(get("/api/v1/workspace/jira/configuration"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.isEnabled").value(true))
            .andExpect(jsonPath("$.data.projectKey").value("SCRUM"))
            .andExpect(jsonPath("$.data.issueType").value("Error"))
    }

    @Test
    fun `should create a jira issue from a failed test case run linking to cherry media instead of uploading it`() {
        val testCaseRun = createTestCaseRun()
        val testCase = getTestCases().first()

        mockMvc.perform(multipart("/api/v1/workspace/test-cases/${testCase.testCaseID}/attachments")
            .file(MockMultipartFile("files", "screenshot.png", "image/png", byteArrayOf(1, 2, 3))))
            .andExpect(status().isOk)
        val attachment = getTestCases().first().attachments.first()

        val request = CreateJiraIssueDTO(
            summary = "Warning sound plays at lock limit",
            stepsToReproduce = "1. Launch trainer\n2. Turn the wheel fully",
            expectedResult = "No warning sound",
            actualResult = "A chime plays",
            buildNumber = "6494",
            cherryBaseURL = "http://192.168.1.20:3000/"
        )

        mockMvc.perform(post("/api/v1/workspace/test-case-runs/${testCaseRun.testCaseRunID}/jira-issue")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.issueKey").value("SCRUM-101"))
            .andExpect(jsonPath("$.data.issueURL").value("$jiraBaseURL/browse/SCRUM-101"))

        // basic auth with the configured email and api token
        val expectedAuthorization = "Basic " + Base64.getEncoder().encodeToString("tester@example.com:secret-token".toByteArray())
        assertTrue(requests.all { it.authorization == expectedAuthorization })

        val createRequest = requests.single { it.method == "POST" && it.path == "/rest/api/3/issue" }
        val fields = objectMapper.readTree(createRequest.body).get("fields")
        assertEquals("SCRUM", fields.get("project").get("key").asText())
        assertEquals("Error", fields.get("issuetype").get("name").asText())
        assertEquals("Warning sound plays at lock limit", fields.get("summary").asText())

        val descriptionText = collectText(fields.get("description"))
        for (expected in listOf("Steps to reproduce", "1. Launch trainer", "2. Turn the wheel fully", "Expected result", "No warning sound",
            "Actual result", "A chime plays", "Build number", "6494", "Evidence", "screenshot.png")) {
            assertTrue(descriptionText.contains(expected), "description is missing '$expected'")
        }
        val descriptionLinks = collectLinks(fields.get("description"))
        assertTrue(descriptionLinks.contains("http://192.168.1.20:3000/attachments/${attachment.attachmentID}"))
        assertTrue(descriptionLinks.contains("http://192.168.1.20:3000/test-cases/TEST/1"))

        // no file is ever uploaded to jira, which would use its storage quota
        assertTrue(requests.none { it.path.contains("attachments") })

        val remoteLink = requests.single { it.path == "/rest/api/3/issue/SCRUM-101/remotelink" }
        assertEquals("http://192.168.1.20:3000/test-cases/TEST/1", objectMapper.readTree(remoteLink.body).get("object").get("url").asText())

        val links = getTestCases().first().jiraLinks
        assertEquals(listOf("SCRUM-101"), links.map { it.issueKey })
    }

    @Test
    fun `should require all description fields before calling jira`() {
        val testCaseRun = createTestCaseRun()

        val request = CreateJiraIssueDTO(
            summary = "Summary",
            stepsToReproduce = "Steps",
            expectedResult = "Expected",
            actualResult = "Actual",
            buildNumber = " ",
            cherryBaseURL = null
        )

        mockMvc.perform(post("/api/v1/workspace/test-case-runs/${testCaseRun.testCaseRunID}/jira-issue")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Build number is required"))

        assertTrue(requests.isEmpty())
    }

    @Test
    fun `should surface jira validation errors`() {
        val testCaseRun = createTestCaseRun()

        val request = CreateJiraIssueDTO("Rejected by Jira", "Steps", "Expected", "Actual", "1", null)

        mockMvc.perform(post("/api/v1/workspace/test-case-runs/${testCaseRun.testCaseRunID}/jira-issue")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("customfield_10010: Field is required")))

        assertEquals(0, getTestCases().first().jiraLinks.size)
    }

    @Test
    fun `should link an existing jira issue from its url and report its status`() {
        createTestCaseRun()
        val testCase = getTestCases().first()

        mockMvc.perform(post("/api/v1/workspace/test-cases/${testCase.testCaseID}/jira-links")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(LinkJiraIssueDTO("https://example.atlassian.net/browse/scrum-7", "http://10.0.0.5:3000"))))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.issueKey").value("SCRUM-7"))

        assertTrue(requests.any { it.path == "/rest/api/3/issue/SCRUM-7/remotelink" })

        // linking the same issue twice is rejected
        mockMvc.perform(post("/api/v1/workspace/test-cases/${testCase.testCaseID}/jira-links")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(LinkJiraIssueDTO("SCRUM-7", null))))
            .andExpect(status().isBadRequest)

        mockMvc.perform(get("/api/v1/workspace/jira/issues").param("keys", "SCRUM-7", "SCRUM-404"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[0].summary").value("Existing bug"))
            .andExpect(jsonPath("$.data[0].status").value("In Progress"))
            .andExpect(jsonPath("$.data[0].statusCategory").value("indeterminate"))
            .andExpect(jsonPath("$.data[1].issueKey").value("SCRUM-404"))
            .andExpect(jsonPath("$.data[1].error").value(Matchers.containsString("not found")))

        val link = getTestCases().first().jiraLinks.single()
        mockMvc.perform(delete("/api/v1/workspace/jira-links/${link.linkID}"))
            .andExpect(status().isOk)
        assertEquals(0, getTestCases().first().jiraLinks.size)
    }

    @Test
    fun `should reject linking issues that do not exist or have invalid keys`() {
        createTestCaseRun()
        val testCase = getTestCases().first()

        mockMvc.perform(post("/api/v1/workspace/test-cases/${testCase.testCaseID}/jira-links")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(LinkJiraIssueDTO("SCRUM-404", null))))
            .andExpect(status().isBadRequest)

        mockMvc.perform(post("/api/v1/workspace/test-cases/${testCase.testCaseID}/jira-links")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(LinkJiraIssueDTO("not a key", null))))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("not a valid Jira issue key")))

        assertEquals(0, getTestCases().first().jiraLinks.size)
    }

    @Test
    fun `should delete test cases with jira links`() {
        createTestCaseRun()
        val testCase = getTestCases().first()

        mockMvc.perform(post("/api/v1/workspace/test-cases/${testCase.testCaseID}/jira-links")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(LinkJiraIssueDTO("SCRUM-7", null))))
            .andExpect(status().isOk)

        // remove the test run first, test cases referenced by test runs can't be deleted
        val testRun = getTestRuns().first()
        mockMvc.perform(delete("/api/v1/workspace/test-runs/${testRun.testRunID}")).andExpect(status().isOk)

        mockMvc.perform(delete("/api/v1/workspace/test-cases/${testCase.testCaseID}"))
            .andExpect(status().isOk)
        assertEquals(0, getTestCases().size)
    }

    private fun collectText(node: JsonNode): String {
        val builder = StringBuilder()
        if (node.has("text")) builder.append(node.get("text").asText()).append('\n')
        node.get("content")?.forEach { builder.append(collectText(it)) }
        return builder.toString()
    }

    private fun collectLinks(node: JsonNode): List<String> {
        val links = node.get("marks")?.mapNotNull { it.get("attrs")?.get("href")?.asText() }.orEmpty()
        return links + node.get("content")?.flatMap { collectLinks(it) }.orEmpty()
    }

    private fun createTestCaseRun(): TestCaseRunDTO {
        mockMvc.perform(post("/api/v1/workspace/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateWorkspaceProjectDTO(title = "Test Project", projectShortCode = "TEST", description = null))))
            .andExpect(status().isOk)

        val properties = readData<List<PropertyConfigurationDTO>>(get("/api/v1/workspace/properties"))
        val testCase = CreateTestCaseDTO(
            title = "Steering warning",
            description = null,
            testInstructions = "1. Launch trainer",
            propertyValues = properties.filter { it.isRequired }.associate { it.propertyConfigurationID to it.defaultValue!! }
        )
        mockMvc.perform(post("/api/v1/workspace/test-cases/TEST")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(testCase)))
            .andExpect(status().isOk)

        mockMvc.perform(post("/api/v1/workspace/test-runs/TEST")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateTestRunDTO(title = "Run", description = null, testCaseIDs = listOf(getTestCases().first().testCaseID)))))
            .andExpect(status().isOk)

        return readData<List<TestCaseRunDTO>>(get("/api/v1/workspace/test-case-runs/TEST/1")).first()
    }

    private fun getTestCases(): List<TestCaseDTO> = readData(get("/api/v1/workspace/test-cases/TEST"))

    private fun getTestRuns(): List<TestRunDTO> = readData(get("/api/v1/workspace/test-runs/TEST"))

    private inline fun <reified T> readData(request: org.springframework.test.web.servlet.RequestBuilder): T {
        val result = mockMvc.perform(request).andExpect(status().isOk).andReturn()
        val data = objectMapper.readTree(result.response.contentAsString).get("data")
        return objectMapper.readValue(data.toString(), objectMapper.typeFactory.constructType(object : com.fasterxml.jackson.core.type.TypeReference<T>() {}))
    }
}
