package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.BatchCreateTestCasesDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
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
import org.springframework.test.web.servlet.ResultActions
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.web.context.WebApplicationContext
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.util.UUID
import kotlin.test.assertEquals

/** Suites, sections and labels that organize a project's test cases. */
@SpringBootTest
@Testcontainers
class OrganizationTests {

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
    private lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    private lateinit var admin: MockMvc

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        admin = TestAuth.authenticatedMockMvc(webApplicationContext, TestAuth.login(webApplicationContext, objectMapper))
        send(post("/api/v1/workspace/projects"), CreateWorkspaceProjectDTO(title = "Project", projectShortCode = "PRJ", description = null))
    }

    @Test
    fun `test cases are filed in suites and nested sections`() {
        // a project starts with a Default suite, where test cases go unless another section is chosen
        createTestCase("Login works", null)
        val default = sections().single()
        assertEquals("Default", default.get("name").asText())
        assertEquals(default.get("sectionID").asText(), testCases()[0].get("sectionID").asText())

        val mobile = createSection("Mobile", null)
        val login = createSection("Login", mobile)
        val sso = createSection("SSO", login)
        createTestCase("SSO works", sso)
        assertEquals(sso, testCases().first { it.get("title").asText() == "SSO works" }.get("sectionID").asText())
        assertEquals(listOf("Default", "Mobile"), sections().filter { it.get("parentID") == null || it.get("parentID").isNull }.map { it.get("name").asText() })

        // a section can't go inside itself or its descendants
        send(put("/api/v1/workspace/sections/$login"), mapOf("name" to "Login", "parentID" to sso))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("inside itself")))

        // sections are renamed, reordered and moved; test cases keep their number when moved
        send(put("/api/v1/workspace/sections/$sso"), mapOf("name" to "Single sign-on", "parentID" to mobile))
        send(post("/api/v1/workspace/sections/$sso/reorder"), mapOf("direction" to "up"))
        val mobileChildren = sections().filter { it.get("parentID")?.asText() == mobile }.sortedBy { it.get("position").asInt() }
        assertEquals(listOf("Single sign-on", "Login"), mobileChildren.map { it.get("name").asText() })

        val loginCase = testCases().first { it.get("title").asText() == "Login works" }
        send(put("/api/v1/workspace/test-cases/section"), mapOf("testCaseIDs" to listOf(loginCase.get("testCaseID").asText()), "sectionID" to login))
        val moved = testCases().first { it.get("title").asText() == "Login works" }
        assertEquals(login, moved.get("sectionID").asText())
        assertEquals(1, moved.get("testCaseNumber").asInt())

        // only empty sections are deleted, and a project keeps at least one suite
        send(delete("/api/v1/workspace/sections/$login"), null).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("Move its test cases")))
        send(delete("/api/v1/workspace/sections/$mobile"), null).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("Move or delete its sections")))
        send(delete("/api/v1/workspace/sections/${default.get("sectionID").asText()}"), null).andExpect(status().isOk)
        send(post("/api/v1/workspace/sections/$mobile/reorder"), mapOf("direction" to "down"))
        assertEquals(listOf("Mobile"), sections().filter { it.get("parentID") == null || it.get("parentID").isNull }.map { it.get("name").asText() })
    }

    @Test
    fun `test cases have free labels`() {
        val dto = testCaseDTO("Checkout", null).copy(labels = listOf(" smoke ", "Smoke", "Payments", ""))
        send(post("/api/v1/workspace/test-cases/PRJ"), dto)
        val testCase = testCases().single()
        // trimmed, without repeats ignoring case, the first spelling wins
        assertEquals(listOf("Payments", "smoke"), testCase.get("labels").map { it.asText() })

        // an update without labels keeps them, an empty list clears them
        val id = testCase.get("testCaseID").asText()
        send(put("/api/v1/workspace/test-cases/$id"), dto.copy(labels = null))
        assertEquals(2, testCases().single().get("labels").size())
        send(put("/api/v1/workspace/test-cases/$id"), dto.copy(labels = listOf("a,b")))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(Matchers.containsString("commas")))
        send(put("/api/v1/workspace/test-cases/$id"), dto.copy(labels = emptyList()))
        assertEquals(0, testCases().single().get("labels").size())
    }

    @Test
    fun `an import goes to the chosen section`() {
        val imported = createSection("Imported", null)
        send(post("/api/v1/workspace/test-cases/PRJ/batch"), BatchCreateTestCasesDTO(
            testCases = listOf(testCaseDTO("First", null), testCaseDTO("Second", null)),
            sectionID = UUID.fromString(imported),
        ))
        assertEquals(listOf(imported, imported), testCases().map { it.get("sectionID").asText() })
    }

    private fun createSection(name: String, parentID: String?): String {
        return data(send(post("/api/v1/workspace/projects/PRJ/sections"), mapOf("name" to name, "parentID" to parentID))).get("sectionID").asText()
    }

    private fun createTestCase(title: String, sectionID: String?) {
        send(post("/api/v1/workspace/test-cases/PRJ"), testCaseDTO(title, sectionID))
    }

    private fun testCaseDTO(title: String, sectionID: String?): CreateTestCaseDTO {
        val values = data(admin.perform(get("/api/v1/workspace/properties")))
            .filter { it.get("isRequired").asBoolean() }
            .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
        return CreateTestCaseDTO(title, null, null, values, sectionID?.let { UUID.fromString(it) })
    }

    private fun sections(): List<JsonNode> = data(admin.perform(get("/api/v1/workspace/projects/PRJ/sections"))).toList()

    private fun testCases(): List<JsonNode> = data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).toList()

    private fun send(request: MockHttpServletRequestBuilder, body: Any?): ResultActions {
        request.contentType(MediaType.APPLICATION_JSON)
        if (body != null) request.content(objectMapper.writeValueAsString(body))
        return admin.perform(request)
    }

    private fun data(result: ResultActions): JsonNode {
        val response = result.andExpect(status().isOk).andReturn()
        return objectMapper.readTree(response.response.contentAsString).get("data")
    }
}
