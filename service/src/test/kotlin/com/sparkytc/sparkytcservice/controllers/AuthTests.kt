package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.auth.ChangePasswordDTO
import com.sparkytc.sparkytcservice.dto.auth.CreateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.UpdateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.properties.CreatePropertyConfigurationDTO
import com.sparkytc.sparkytcservice.dto.properties.PropertyConfigurationType
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
import org.springframework.http.HttpHeaders
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
class AuthTests {

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

    @Autowired
    private lateinit var databaseMigrator: DatabaseMigrator

    @Autowired
    private lateinit var adminBootstrap: AdminBootstrap

    @Autowired
    private lateinit var context: WebApplicationContext

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    private lateinit var anonymous: MockMvc
    private lateinit var admin: MockMvc

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        anonymous = TestAuth.anonymousMockMvc(context)
        admin = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper))
    }

    @Test
    fun `should reject requests without a valid session`() {
        anonymous.perform(get("/api/v1/workspace/projects"))
            .andExpect(status().isUnauthorized)

        anonymous.perform(get("/api/v1/workspace/projects").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-real-token"))
            .andExpect(status().isUnauthorized)

        anonymous.perform(get("/api/v1/workspace/attachments/${UUID.randomUUID()}"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `should reject invalid credentials`() {
        for ((username, password) in listOf("admin" to "wrong-password", "nobody" to "admin-password")) {
            anonymous.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mapOf("username" to username, "password" to password))))
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.message").value("Invalid username or password"))
        }
    }

    @Test
    fun `should sign in case insensitively and sign out`() {
        val token = TestAuth.login(context, objectMapper, username = "ADMIN")
        val session = TestAuth.authenticatedMockMvc(context, token)

        session.perform(get("/api/v1/auth/me"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.username").value("admin"))
            .andExpect(jsonPath("$.data.role").value("ADMIN"))

        session.perform(post("/api/v1/auth/logout")).andExpect(status().isOk)
        session.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized)
    }

    @Test
    fun `testers can work on test cases but not perform admin actions`() {
        createUser("tester", "Test Er", UserRole.TESTER)
        val tester = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "tester", "tester-password"))

        tester.perform(post("/api/v1/workspace/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateWorkspaceProjectDTO("Project", "PRJ", null))))
            .andExpect(status().isForbidden)
        admin.perform(post("/api/v1/workspace/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateWorkspaceProjectDTO("Project", "PRJ", null))))
            .andExpect(status().isOk)
        assignProjects("tester", "PRJ")
        tester.perform(post("/api/v1/workspace/test-cases/PRJ")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(testCase("Login"))))
            .andExpect(status().isOk)
        val testCaseID = data(tester, "/api/v1/workspace/test-cases/PRJ")[0].get("testCaseID").asText()

        // admin only endpoints
        tester.perform(get("/api/v1/admin/users")).andExpect(status().isForbidden)
        tester.perform(post("/api/v1/workspace/properties")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreatePropertyConfigurationDTO("Area", PropertyConfigurationType.TEXT, false, null, null))))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.message").value("Only admins can perform this action"))
        tester.perform(delete("/api/v1/workspace/test-cases/$testCaseID")).andExpect(status().isForbidden)

        admin.perform(delete("/api/v1/workspace/test-cases/$testCaseID")).andExpect(status().isOk)
    }

    @Test
    fun `should record who created, updated and executed records`() {
        createUser("ana", "Ana Tester", UserRole.TESTER)
        val ana = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "ana", "tester-password"))

        admin.perform(post("/api/v1/workspace/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateWorkspaceProjectDTO("Project", "PRJ", null))))
            .andExpect(status().isOk)
        assignProjects("ana", "PRJ")
        ana.perform(post("/api/v1/workspace/test-cases/PRJ")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(testCase("Login"))))
            .andExpect(status().isOk)
        val testCaseID = data(admin, "/api/v1/workspace/test-cases/PRJ")[0].get("testCaseID").asText()

        admin.perform(put("/api/v1/workspace/test-cases/$testCaseID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(testCase("Login updated"))))
            .andExpect(status().isOk)

        val testCase = data(admin, "/api/v1/workspace/test-cases/PRJ")[0]
        assertEquals("Ana Tester", testCase.get("createdBy").asText())
        assertEquals("admin", testCase.get("updatedBy").asText())

        ana.perform(post("/api/v1/workspace/test-runs/PRJ")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateTestRunDTO("Run", null, listOf(UUID.fromString(testCaseID))))))
            .andExpect(status().isOk)
        assertEquals("Ana Tester", data(admin, "/api/v1/workspace/test-runs/PRJ")[0].get("createdBy").asText())

        val testCaseRunID = data(admin, "/api/v1/workspace/test-case-runs/PRJ/1")[0].get("testCaseRunID").asText()
        ana.perform(put("/api/v1/workspace/test-case-runs/$testCaseRunID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateTestCaseRunDTO(TestCaseRunStatus.FAIL, "broken"))))
            .andExpect(status().isOk)
        assertEquals("Ana Tester", data(admin, "/api/v1/workspace/test-case-runs/PRJ/1")[0].get("executedBy").asText())
    }

    @Test
    fun `should validate new users`() {
        createUser("tester", "Tester", UserRole.TESTER)

        for (request in listOf(
            CreateUserDTO("TESTER", "Duplicate", UserRole.TESTER, "tester-password"),
            CreateUserDTO("short", "Short password", UserRole.TESTER, "1234567"),
            CreateUserDTO("a", "Invalid username", UserRole.TESTER, "tester-password"),
            CreateUserDTO("no spaces", "Invalid username", UserRole.TESTER, "tester-password"),
        )) {
            admin.perform(post("/api/v1/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest)
        }
    }

    @Test
    fun `deactivating a user or resetting their password signs them out`() {
        val userID = createUser("tester", "Tester", UserRole.TESTER)
        val tester = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "tester", "tester-password"))

        admin.perform(put("/api/v1/admin/users/$userID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateUserDTO("Tester", UserRole.TESTER, true, "new-password-1"))))
            .andExpect(status().isOk)
        tester.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized)
        val newSession = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "tester", "new-password-1"))

        admin.perform(put("/api/v1/admin/users/$userID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateUserDTO("Tester", UserRole.TESTER, false))))
            .andExpect(status().isOk)
        newSession.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized)
        anonymous.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(mapOf("username" to "tester", "password" to "new-password-1"))))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `should keep at least one active admin`() {
        val adminID = data(admin, "/api/v1/admin/users")[0].get("userID").asText()

        admin.perform(put("/api/v1/admin/users/$adminID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateUserDTO("admin", UserRole.TESTER, true))))
            .andExpect(status().isBadRequest)

        // another admin can demote the first one
        createUser("second", "Second Admin", UserRole.ADMIN)
        val second = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "second", "tester-password"))
        second.perform(put("/api/v1/admin/users/$adminID")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(UpdateUserDTO("admin", UserRole.TESTER, true))))
            .andExpect(status().isOk)
    }

    @Test
    fun `users can change their own password`() {
        admin.perform(put("/api/v1/auth/password")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(ChangePasswordDTO("wrong", "another-password"))))
            .andExpect(status().isBadRequest)

        admin.perform(put("/api/v1/auth/password")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(ChangePasswordDTO(TestAuth.ADMIN_PASSWORD, "another-password"))))
            .andExpect(status().isOk)

        TestAuth.login(context, objectMapper, password = "another-password")
    }

    private fun assignProjects(username: String, vararg projectShortCodes: String) {
        val userID = data(admin, "/api/v1/admin/users").first { it.get("username").asText() == username }.get("userID").asText()
        val projectIDs = data(admin, "/api/v1/workspace/projects")
            .filter { it.get("projectShortCode").asText() in projectShortCodes }
            .map { it.get("projectID").asText() }
        admin.perform(put("/api/v1/admin/users/$userID/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(mapOf("projectIDs" to projectIDs))))
            .andExpect(status().isOk)
    }

    private fun createUser(username: String, displayName: String, role: UserRole): String {
        val result = admin.perform(post("/api/v1/admin/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateUserDTO(username, displayName, role, "tester-password"))))
            .andExpect(status().isOk)
            .andReturn()
        return objectMapper.readTree(result.response.contentAsString).get("data").get("userID").asText()
    }

    private fun testCase(title: String): CreateTestCaseDTO {
        val properties = data(admin, "/api/v1/workspace/properties")
        val values = properties.filter { it.get("isRequired").asBoolean() }
            .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
        return CreateTestCaseDTO(title, null, null, values)
    }

    private fun data(mockMvc: MockMvc, url: String): JsonNode {
        val result = mockMvc.perform(get(url)).andExpect(status().isOk).andReturn()
        return objectMapper.readTree(result.response.contentAsString).get("data")
    }
}
