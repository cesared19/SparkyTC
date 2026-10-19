package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.auth.CreateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.CreateTestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestRunStatus
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.hamcrest.Matchers
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.web.context.WebApplicationContext
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.util.UUID
import kotlin.test.assertEquals

@SpringBootTest
@Testcontainers
class ResponsibilityTests {

    companion object {
        @Container
        private val postgresContainer = PostgreSQLContainer<Nothing>("postgres:latest").apply {
            withDatabaseName("testdb")
            withUsername("test")
            withPassword("test")
        }

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgresContainer::getJdbcUrl)
            registry.add("spring.datasource.username", postgresContainer::getUsername)
            registry.add("spring.datasource.password", postgresContainer::getPassword)
        }
    }

    @Autowired private lateinit var databaseMigrator: DatabaseMigrator
    @Autowired private lateinit var adminBootstrap: AdminBootstrap
    @Autowired private lateinit var context: WebApplicationContext
    @Autowired private lateinit var objectMapper: ObjectMapper

    private lateinit var admin: MockMvc
    private lateinit var ana: MockMvc
    private lateinit var beto: MockMvc
    private val userIDs = mutableMapOf<String, String>()

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        admin = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper))

        post(admin, "/api/v1/workspace/projects", CreateWorkspaceProjectDTO("Project", "PRJ", null))
        post(admin, "/api/v1/workspace/projects", CreateWorkspaceProjectDTO("Other", "OTH", null))
        for (name in listOf("ana", "beto", "carla")) {
            val user = post(admin, "/api/v1/admin/users", CreateUserDTO(name, name.replaceFirstChar { it.uppercase() }, UserRole.TESTER, "tester-password"))
            userIDs[name] = user.get("data").get("userID").asText()
        }
        assignProjects("ana", "PRJ")
        assignProjects("beto", "PRJ")
        // carla can only see the other project
        assignProjects("carla", "OTH")
        userIDs["admin"] = data(admin, "/api/v1/auth/me").get("userID").asText()

        ana = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "ana", "tester-password"))
        beto = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "beto", "tester-password"))
    }

    @Test
    fun `project users are the admins and the testers that can see the project except the super admin`() {
        post(admin, "/api/v1/admin/users", CreateUserDTO("lead", "Lead", UserRole.ADMIN, "tester-password"))
        val names = data(ana, "/api/v1/workspace/projects/PRJ/users").map { it.get("displayName").asText() }
        assertEquals(listOf("Ana", "Beto", "Lead"), names)
    }

    @Test
    fun `assigning a test run notifies the assignees except whoever assigned them`() {
        createTestRun(assignees = listOf("ana", "beto"), creator = ana)

        val testRun = data(admin, "/api/v1/workspace/test-runs/PRJ")[0]
        assertEquals(listOf("Ana", "Beto"), testRun.get("assignees").map { it.get("displayName").asText() })

        assertEquals(0, data(ana, "/api/v1/notifications").get("unreadCount").asInt())
        val betoNotifications = data(beto, "/api/v1/notifications")
        assertEquals(1, betoNotifications.get("unreadCount").asInt())
        val notification = betoNotifications.get("notifications")[0]
        assertEquals("TEST_RUN_ASSIGNED", notification.get("type").asText())
        assertEquals("/test-runs/PRJ/1", notification.get("link").asText())

        put(beto, "/api/v1/notifications/${notification.get("notificationID").asText()}/read", null)
        assertEquals(0, data(beto, "/api/v1/notifications").get("unreadCount").asInt())
    }

    @Test
    fun `users without access to the project can't be assigned`() {
        admin.perform(post("/api/v1/workspace/test-runs/PRJ")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateTestRunDTO("Run", null, testCaseIDs(), listOf(UUID.fromString(userIDs["carla"]))))))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `testers take test cases so others don't duplicate the work`() {
        createTestRun(assignees = listOf("ana", "beto"))
        val (first, second) = testCaseRunIDs()

        // ana takes the first test case
        put(ana, "/api/v1/workspace/test-case-runs/$first/assignee", mapOf("userID" to userIDs["ana"]))
        assertEquals("Ana", testCaseRuns()[0].get("assignedTo").get("displayName").asText())

        // beto can't take it, assign it to someone else, or record its result
        expectError(beto, put("/api/v1/workspace/test-case-runs/$first/assignee"), mapOf("userID" to userIDs["beto"]), "This test case is assigned to Ana")
        expectError(beto, put("/api/v1/workspace/test-case-runs/$second/assignee"), mapOf("userID" to userIDs["ana"]), "Only admins can assign test cases to other users")
        expectError(beto, put("/api/v1/workspace/test-case-runs/$first"), UpdateTestCaseRunDTO(TestCaseRunStatus.PASS, null), "This test case is assigned to Ana")

        // recording an unassigned test case takes it, and shows who completed it
        put(beto, "/api/v1/workspace/test-case-runs/$second", UpdateTestCaseRunDTO(TestCaseRunStatus.FAIL, null))
        val secondRun = testCaseRuns()[1]
        assertEquals("Beto", secondRun.get("assignedTo").get("displayName").asText())
        assertEquals("Beto", secondRun.get("executedBy").asText())

        // ana gives her test case back, then an admin reassigns it to beto
        put(ana, "/api/v1/workspace/test-case-runs/$first/assignee", mapOf("userID" to null))
        put(admin, "/api/v1/workspace/test-case-runs/$first/assignee", mapOf("userID" to userIDs["beto"]))
        assertEquals("Beto", testCaseRuns()[0].get("assignedTo").get("displayName").asText())
    }

    @Test
    fun `only admins change test run assignments and only while the test run is open`() {
        createTestRun(assignees = listOf("ana"))
        val testRunID = data(admin, "/api/v1/workspace/test-runs/PRJ")[0].get("testRunID").asText()
        val (first) = testCaseRunIDs()
        put(ana, "/api/v1/workspace/test-case-runs/$first/assignee", mapOf("userID" to userIDs["ana"]))

        ana.perform(put("/api/v1/workspace/test-runs/$testRunID/assignees")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(mapOf("userIDs" to listOf(userIDs["beto"])))))
            .andExpect(status().isForbidden)

        // replacing ana with beto frees her pending test case and notifies beto
        put(admin, "/api/v1/workspace/test-runs/$testRunID/assignees", mapOf("userIDs" to listOf(userIDs["beto"])))
        assertEquals(listOf("Beto"), data(admin, "/api/v1/workspace/test-runs/PRJ")[0].get("assignees").map { it.get("displayName").asText() })
        assertEquals(null, testCaseRuns()[0].get("assignedTo"))
        assertEquals(1, data(beto, "/api/v1/notifications").get("unreadCount").asInt())

        put(admin, "/api/v1/workspace/test-runs/$testRunID", UpdateTestRunDTO("Run", null, TestRunStatus.ABORT))
        expectError(admin, put("/api/v1/workspace/test-runs/$testRunID/assignees"), mapOf("userIDs" to listOf(userIDs["ana"])), "Assignments can't be changed once the test run is closed")
        expectError(admin, put("/api/v1/workspace/test-case-runs/$first/assignee"), mapOf("userID" to userIDs["ana"]), "Assignments can't be changed once the test run is closed")
    }

    @Test
    fun `completing a test run notifies everyone who can see the project`() {
        createTestRun(assignees = emptyList())
        put(beto, "/api/v1/auth/preferences/notifications", mapOf("testRunAssigned" to true, "testRunCompleted" to false))

        for (testCaseRunID in testCaseRunIDs()) {
            put(ana, "/api/v1/workspace/test-case-runs/$testCaseRunID", UpdateTestCaseRunDTO(TestCaseRunStatus.PASS, null))
        }
        assertEquals("COMPLETE", data(admin, "/api/v1/workspace/test-runs/PRJ")[0].get("status").asText())

        val anaNotification = data(ana, "/api/v1/notifications").get("notifications")[0]
        assertEquals("TEST_RUN_COMPLETED", anaNotification.get("type").asText())
        assertEquals(1, data(admin, "/api/v1/notifications").get("unreadCount").asInt())
        // beto turned these notifications off, carla can't see the project
        assertEquals(0, data(beto, "/api/v1/notifications").get("unreadCount").asInt())
        val carla = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "carla", "tester-password"))
        assertEquals(0, data(carla, "/api/v1/notifications").get("unreadCount").asInt())
        assertEquals(false, data(beto, "/api/v1/auth/me").get("notifyTestRunCompleted").asBoolean())

        put(admin, "/api/v1/notifications/read-all", null)
        assertEquals(0, data(admin, "/api/v1/notifications").get("unreadCount").asInt())
    }

    @Test
    fun `users delete their read notifications`() {
        createTestRun(assignees = listOf("beto"))
        createTestRun(assignees = listOf("beto"))
        val notifications = data(beto, "/api/v1/notifications").get("notifications").map { it.get("notificationID").asText() }
        assertEquals(2, notifications.size)

        // unread notifications and other users' notifications can't be deleted
        beto.perform(delete("/api/v1/notifications/${notifications[0]}"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("Only read notifications can be deleted")))
        put(beto, "/api/v1/notifications/${notifications[0]}/read", null)
        ana.perform(delete("/api/v1/notifications/${notifications[0]}")).andExpect(status().isBadRequest)

        beto.perform(delete("/api/v1/notifications/${notifications[0]}")).andExpect(status().isOk)
        assertEquals(listOf(notifications[1]), data(beto, "/api/v1/notifications").get("notifications").map { it.get("notificationID").asText() })

        // deleting all read notifications keeps the unread ones
        beto.perform(delete("/api/v1/notifications/read")).andExpect(status().isOk)
        assertEquals(1, data(beto, "/api/v1/notifications").get("notifications").size())
        put(beto, "/api/v1/notifications/read-all", null)
        beto.perform(delete("/api/v1/notifications/read")).andExpect(status().isOk)
        assertEquals(0, data(beto, "/api/v1/notifications").get("notifications").size())
    }

    @Test
    fun `only admins change project settings and jira keys are validated`() {
        ana.perform(put("/api/v1/workspace/projects/PRJ/settings")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"jiraFailureMode":"DISABLED","jiraProjectKey":null}"""))
            .andExpect(status().isForbidden)

        expectError(admin, put("/api/v1/workspace/projects/PRJ/settings"), mapOf("jiraFailureMode" to "MANUAL", "jiraProjectKey" to "not valid"), "is not a valid Jira project key")

        put(admin, "/api/v1/workspace/projects/PRJ/settings", mapOf("jiraFailureMode" to "AUTOMATIC", "jiraProjectKey" to "qa"))
        val project = data(ana, "/api/v1/workspace/projects").first { it.get("projectShortCode").asText() == "PRJ" }
        assertEquals("AUTOMATIC", project.get("jiraFailureMode").asText())
        assertEquals("QA", project.get("jiraProjectKey").asText())
    }

    private fun createTestRun(assignees: List<String>, creator: MockMvc = admin) {
        post(creator, "/api/v1/workspace/test-runs/PRJ", CreateTestRunDTO("Run", null, testCaseIDs(), assignees.map { UUID.fromString(userIDs[it]) }))
    }

    private fun testCaseIDs(): List<UUID> {
        if (data(admin, "/api/v1/workspace/test-cases/PRJ").size() == 0) {
            val values = data(admin, "/api/v1/workspace/properties")
                .filter { it.get("isRequired").asBoolean() }
                .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
            repeat(2) { post(admin, "/api/v1/workspace/test-cases/PRJ", CreateTestCaseDTO("Case ${it + 1}", null, null, values)) }
        }
        return data(admin, "/api/v1/workspace/test-cases/PRJ").map { UUID.fromString(it.get("testCaseID").asText()) }
    }

    private fun testCaseRuns(): JsonNode = data(admin, "/api/v1/workspace/test-case-runs/PRJ/1")

    private fun testCaseRunIDs(): List<String> = testCaseRuns().map { it.get("testCaseRunID").asText() }

    private fun assignProjects(username: String, vararg shortCodes: String) {
        val projectIDs = data(admin, "/api/v1/workspace/projects")
            .filter { it.get("projectShortCode").asText() in shortCodes }
            .map { it.get("projectID").asText() }
        put(admin, "/api/v1/admin/users/${userIDs[username]}/projects", mapOf("projectIDs" to projectIDs))
    }

    private fun post(mockMvc: MockMvc, url: String, body: Any): JsonNode {
        val result = mockMvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isOk).andReturn()
        return objectMapper.readTree(result.response.contentAsString)
    }

    private fun put(mockMvc: MockMvc, url: String, body: Any?) {
        val request = put(url).contentType(MediaType.APPLICATION_JSON)
        if (body != null) request.content(objectMapper.writeValueAsString(body))
        mockMvc.perform(request).andExpect(status().isOk)
    }

    private fun expectError(mockMvc: MockMvc, request: org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder, body: Any, message: String) {
        mockMvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString(message)))
    }

    private fun data(mockMvc: MockMvc, url: String): JsonNode {
        val result = mockMvc.perform(get(url)).andExpect(status().isOk).andReturn()
        return objectMapper.readTree(result.response.contentAsString).get("data")
    }
}
