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
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
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
import kotlin.test.assertNull

@SpringBootTest
@Testcontainers
class ProjectAccessTests {

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
    private lateinit var tester: MockMvc
    private lateinit var testerID: String

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        admin = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper))

        val result = admin.perform(post("/api/v1/admin/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateUserDTO("tester", "Tester", UserRole.TESTER, "tester-password"))))
            .andExpect(status().isOk)
            .andReturn()
        testerID = objectMapper.readTree(result.response.contentAsString).get("data").get("userID").asText()
        tester = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "tester", "tester-password"))

        createProject("Visible", "VIS")
        createProject("Hidden", "HID")
    }

    @Test
    fun `testers only see the projects assigned to them`() {
        assertEquals(0, data(tester, "/api/v1/workspace/projects").size())
        assertEquals(2, data(admin, "/api/v1/workspace/projects").size())

        assignProjects("VIS")

        val projects = data(tester, "/api/v1/workspace/projects")
        assertEquals(listOf("VIS"), projects.map { it.get("projectShortCode").asText() })

        val users = data(admin, "/api/v1/admin/users")
        assertEquals(1, users.first { it.get("username").asText() == "tester" }.get("projectIDs").size())
    }

    @Test
    fun `testers can't read or change anything in projects they aren't assigned to`() {
        assignProjects("VIS")
        val hiddenTestCaseID = createTestCase("HID")
        val testCaseRunID = createTestRun("HID", hiddenTestCaseID)
        admin.perform(multipart("/api/v1/workspace/test-cases/$hiddenTestCaseID/attachments")
            .file(MockMultipartFile("files", "secret.png", "image/png", byteArrayOf(1))))
            .andExpect(status().isOk)
        val attachmentID = data(admin, "/api/v1/workspace/test-cases/HID")[0].get("attachments")[0].get("attachmentID").asText()

        for (request in listOf(
            get("/api/v1/workspace/test-cases/HID"),
            get("/api/v1/workspace/test-runs/HID"),
            get("/api/v1/workspace/test-case-runs/HID/1"),
            get("/api/v1/workspace/projects/HID/dashboard"),
            get("/api/v1/workspace/attachments/$attachmentID"),
            get("/api/v1/workspace/test-case-runs/$testCaseRunID/next"),
            put("/api/v1/workspace/test-cases/$hiddenTestCaseID")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testCase("Changed"))),
            put("/api/v1/workspace/test-case-runs/$testCaseRunID")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(UpdateTestCaseRunDTO(TestCaseRunStatus.PASS, null))),
            post("/api/v1/workspace/test-cases/HID")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testCase("New"))),
            multipart("/api/v1/workspace/test-cases/$hiddenTestCaseID/attachments")
                .file(MockMultipartFile("files", "a.png", "image/png", byteArrayOf(1))),
        )) {
            tester.perform(request)
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("No ")))
        }

        // nothing changed
        assertEquals("Test case", data(admin, "/api/v1/workspace/test-cases/HID")[0].get("title").asText())
        assertEquals("PENDING", data(admin, "/api/v1/workspace/test-case-runs/HID/1")[0].get("status").asText())
    }

    @Test
    fun `test runs can only include test cases from their own project`() {
        assignProjects("VIS")
        val hiddenTestCaseID = createTestCase("HID")

        tester.perform(post("/api/v1/workspace/test-runs/VIS")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateTestRunDTO("Run", null, listOf(UUID.fromString(hiddenTestCaseID))))))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `users can set their theme and default project`() {
        assignProjects("VIS")

        tester.perform(put("/api/v1/auth/preferences/theme")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"theme":"DARK"}"""))
            .andExpect(status().isOk)
        tester.perform(put("/api/v1/auth/preferences/default-project")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"projectShortCode":"VIS"}"""))
            .andExpect(status().isOk)

        // projects the user can't see can't be the default
        tester.perform(put("/api/v1/auth/preferences/default-project")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"projectShortCode":"HID"}"""))
            .andExpect(status().isBadRequest)

        val me = data(tester, "/api/v1/auth/me")
        assertEquals("DARK", me.get("theme").asText())
        assertEquals("VIS", me.get("defaultProjectShortCode").asText())

        // losing access to the default project clears it
        assignProjects()
        assertNull(data(tester, "/api/v1/auth/me").get("defaultProjectShortCode"))
    }

    @Test
    fun `the dashboard summarizes test cases and test runs`() {
        val first = createTestCase("VIS")
        val second = createTestCase("VIS")
        val testCaseRunID = createTestRun("VIS", first, second)
        admin.perform(put("/api/v1/workspace/test-case-runs/$testCaseRunID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateTestCaseRunDTO(TestCaseRunStatus.FAIL, null))))
            .andExpect(status().isOk)

        val dashboard = data(admin, "/api/v1/workspace/projects/VIS/dashboard")
        assertEquals(2, dashboard.get("testCaseCount").asInt())
        assertEquals(1, dashboard.get("testRunCounts").get("IN_PROGRESS").asInt())
        val priority = dashboard.get("propertyBreakdowns").first { it.get("title").asText() == "Priority" }
        assertEquals(2, priority.get("counts").first { it.get("value").asText() == "Critical" }.get("count").asInt())

        val activeRun = dashboard.get("activeTestRuns")[0]
        assertEquals(2, activeRun.get("totalCount").asInt())
        assertEquals(1, activeRun.get("resultCounts").get("FAIL").asInt())
        assertEquals(1, activeRun.get("resultCounts").get("PENDING").asInt())
        assertEquals(0, dashboard.get("recentTestRuns").size())
    }

    private fun createProject(title: String, shortCode: String) {
        admin.perform(post("/api/v1/workspace/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateWorkspaceProjectDTO(title, shortCode, null))))
            .andExpect(status().isOk)
    }

    private fun assignProjects(vararg shortCodes: String) {
        val projectIDs = data(admin, "/api/v1/workspace/projects")
            .filter { it.get("projectShortCode").asText() in shortCodes }
            .map { it.get("projectID").asText() }
        admin.perform(put("/api/v1/admin/users/$testerID/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(mapOf("projectIDs" to projectIDs))))
            .andExpect(status().isOk)
    }

    private fun testCase(title: String): CreateTestCaseDTO {
        val values = data(admin, "/api/v1/workspace/properties")
            .filter { it.get("isRequired").asBoolean() }
            .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
        return CreateTestCaseDTO(title, null, null, values)
    }

    private fun createTestCase(shortCode: String): String {
        admin.perform(post("/api/v1/workspace/test-cases/$shortCode")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(testCase("Test case"))))
            .andExpect(status().isOk)
        return data(admin, "/api/v1/workspace/test-cases/$shortCode").last().get("testCaseID").asText()
    }

    private fun createTestRun(shortCode: String, vararg testCaseIDs: String): String {
        admin.perform(post("/api/v1/workspace/test-runs/$shortCode")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateTestRunDTO("Run", null, testCaseIDs.map { UUID.fromString(it) }))))
            .andExpect(status().isOk)
        return data(admin, "/api/v1/workspace/test-case-runs/$shortCode/1")[0].get("testCaseRunID").asText()
    }

    private fun data(mockMvc: MockMvc, url: String): JsonNode {
        val result = mockMvc.perform(get(url)).andExpect(status().isOk).andReturn()
        return objectMapper.readTree(result.response.contentAsString).get("data")
    }
}
