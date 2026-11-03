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
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActions
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.context.WebApplicationContext
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Project API tokens and the read-only integration API other apps (co-bord) use. */
@SpringBootTest
@Testcontainers
class IntegrationApiTests {

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
    private lateinit var anonymous: MockMvc

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        admin = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper))
        anonymous = TestAuth.anonymousMockMvc(context)
        send(post("/api/v1/workspace/projects"), CreateWorkspaceProjectDTO(title = "Project", projectShortCode = "PRJ", description = null))
        send(post("/api/v1/workspace/projects"), CreateWorkspaceProjectDTO(title = "Other", projectShortCode = "OTH", description = null))
    }

    @Test
    fun `only admins manage tokens, and the secret is shown once`() {
        send(post("/api/v1/admin/users"), CreateUserDTO("tester", "Tester", UserRole.TESTER, "tester-password")).andExpect(status().isOk)
        val tester = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, "tester", "tester-password"))
        tester.perform(post("/api/v1/workspace/projects/PRJ/api-tokens").contentType(MediaType.APPLICATION_JSON).content("""{"name":"co-bord"}"""))
            .andExpect(status().isForbidden)
        tester.perform(get("/api/v1/workspace/projects/PRJ/api-tokens")).andExpect(status().isForbidden)

        send(post("/api/v1/workspace/projects/PRJ/api-tokens"), mapOf("name" to " ")).andExpect(status().isBadRequest)
        val created = data(send(post("/api/v1/workspace/projects/PRJ/api-tokens"), mapOf("name" to "co-bord")))
        val secret = created.get("secret").asText()
        assertTrue(secret.startsWith("stc_"))
        assertTrue(secret.startsWith(created.get("token").get("tokenPrefix").asText()))

        val listed = data(admin.perform(get("/api/v1/workspace/projects/PRJ/api-tokens")))
        assertEquals(1, listed.size())
        assertEquals("co-bord", listed[0].get("name").asText())
        assertFalse(listed[0].has("secret"))
        assertFalse(listed[0].has("lastUsedAt"))

        integration(secret, get("/api/integration/v1/project")).andExpect(status().isOk)
        assertTrue(data(admin.perform(get("/api/v1/workspace/projects/PRJ/api-tokens")))[0].has("lastUsedAt"))

        send(delete("/api/v1/workspace/api-tokens/${listed[0].get("tokenID").asText()}"), null).andExpect(status().isOk)
        integration(secret, get("/api/integration/v1/project")).andExpect(status().isUnauthorized)
    }

    @Test
    fun `the integration API needs a project token, not a session`() {
        anonymous.perform(get("/api/integration/v1/project")).andExpect(status().isUnauthorized)
        integration("stc_not-a-real-token", get("/api/integration/v1/project")).andExpect(status().isUnauthorized)
        // a user's session token doesn't open it either
        admin.perform(get("/api/integration/v1/project")).andExpect(status().isUnauthorized)
        // and a project token doesn't open the app's API
        val secret = token("PRJ")
        integration(secret, get("/api/v1/workspace/projects")).andExpect(status().isUnauthorized)
    }

    @Test
    fun `reads the token's project and the latest results per build`() {
        val checkout = createSection("Checkout", null)
        val payments = createSection("Payments", checkout)
        val card = createTestCase("Pay with card", payments, listOf("smoke"))
        val refund = createTestCase("Refund", checkout, emptyList())
        val login = createTestCase("Login", createSection("Account", null), emptyList())
        // the same title in another project stays out of sight
        send(post("/api/v1/workspace/test-cases/OTH"), testCaseDTO("Pay with card", null, emptyList())).andExpect(status().isOk)

        val plan = data(send(post("/api/v1/workspace/projects/PRJ/test-plans"), mapOf(
            "name" to "Checkout plan", "sectionIDs" to listOf(checkout), "testCaseIDs" to listOf(login),
        ))).get("testPlanID").asText()

        // build 1.0: card fails, refund passes
        val oldBuild = createBuild("1.0")
        createRun(1, oldBuild, card to TestCaseRunStatus.FAIL, refund to TestCaseRunStatus.PASS)
        // build 1.1: card passes, then a later run leaves it pending and blocks refund
        val newBuild = createBuild("1.1")
        createRun(2, newBuild, card to TestCaseRunStatus.PASS)
        createRun(3, newBuild, card to null, refund to TestCaseRunStatus.BLOCKED)

        val secret = token("PRJ")
        val project = data(integration(secret, get("/api/integration/v1/project")))
        assertEquals("PRJ", project.get("projectShortCode").asText())
        assertEquals("1.1", project.get("currentBuild").get("buildNumber").asText())
        assertEquals(listOf("1.1", "1.0"), project.get("builds").map { it.get("buildNumber").asText() })

        val sections = data(integration(secret, get("/api/integration/v1/sections"))).associateBy { it.get("path").asText() }
        assertEquals(2, sections["Checkout"]!!.get("testCaseCount").asInt())
        assertEquals(1, sections["Checkout / Payments"]!!.get("testCaseCount").asInt())
        assertEquals("/test-cases/PRJ?section=$payments", sections["Checkout / Payments"]!!.get("webPath").asText())

        val found = data(integration(secret, get("/api/integration/v1/test-cases").param("query", "PAY")))
        assertEquals(1, found.size())
        assertEquals("Checkout / Payments", found[0].get("sectionPath").asText())
        assertEquals(listOf("smoke"), found[0].get("labels").map { it.asText() })
        assertEquals("/test-cases/PRJ/1", found[0].get("webPath").asText())
        assertEquals(1, data(integration(secret, get("/api/integration/v1/test-cases").param("query", "#3"))).size())
        assertEquals(3, data(integration(secret, get("/api/integration/v1/test-cases"))).size())

        val plans = data(integration(secret, get("/api/integration/v1/test-plans")))
        assertEquals(3, plans[0].get("testCaseCount").asInt())

        val current = data(integration(secret, post("/api/integration/v1/results"), mapOf(
            "testCaseNumbers" to listOf(1, 2, 3, 99),
            "sectionIDs" to listOf(checkout, UUID.randomUUID().toString()),
            "testPlanIDs" to listOf(plan),
        )))
        assertEquals("1.1", current.get("build").get("buildNumber").asText())
        val cases = current.get("testCases").associateBy { it.get("testCaseNumber").asInt() }
        // a pending test case in a later run doesn't hide the earlier pass
        assertEquals("PASS", cases[1]!!.get("status").asText())
        assertEquals(2, cases[1]!!.get("testRunNumber").asInt())
        assertEquals("BLOCKED", cases[2]!!.get("status").asText())
        assertEquals("NOT_RUN", cases[3]!!.get("status").asText())
        assertFalse(cases[3]!!.has("executedAt"))
        assertEquals(listOf(99), current.get("missingTestCaseNumbers").map { it.asInt() })
        assertEquals(1, current.get("missingSectionIDs").size())

        val section = current.get("sections")[0]
        assertEquals(2, section.get("counts").get("total").asInt())
        assertEquals(1, section.get("counts").get("passed").asInt())
        assertEquals(1, section.get("counts").get("blocked").asInt())
        assertEquals("BLOCKED", section.get("status").asText())
        val planResult = current.get("testPlans")[0]
        assertEquals(3, planResult.get("counts").get("total").asInt())
        assertEquals(1, planResult.get("counts").get("notRun").asInt())

        val old = data(integration(secret, post("/api/integration/v1/results"), mapOf("testCaseNumbers" to listOf(1, 2), "build" to "1.0")))
        assertEquals(listOf("FAIL", "PASS"), old.get("testCases").map { it.get("status").asText() })
        integration(secret, post("/api/integration/v1/results"), mapOf("build" to "9.9")).andExpect(status().isBadRequest)

        // the other project's token sees only its own test case
        val other = token("OTH")
        assertEquals(listOf(1), data(integration(other, get("/api/integration/v1/test-cases"))).map { it.get("testCaseNumber").asInt() })
        val otherResults = data(integration(other, post("/api/integration/v1/results"), mapOf("sectionIDs" to listOf(checkout))))
        assertEquals(1, otherResults.get("missingSectionIDs").size())
    }

    @Test
    fun `only read and write tokens create, and revoking keeps what they created credited`() {
        val read = token("PRJ")
        val write = token("PRJ", canWrite = true)
        assertEquals(listOf("read"), data(integration(read, get("/api/integration/v1/project"))).get("permissions").map { it.asText() })
        assertEquals(listOf("read", "write"), data(integration(write, get("/api/integration/v1/project"))).get("permissions").map { it.asText() })
        assertEquals(listOf(true, false), data(admin.perform(get("/api/v1/workspace/projects/PRJ/api-tokens"))).map { it.get("canWrite").asBoolean() })

        // a read token can't create, but still asks for results with a POST
        val denied = integration(read, post("/api/integration/v1/test-cases"), mapOf("title" to "Nope")).andExpect(status().isForbidden)
        assertEquals("This token can only read. Create a Read and write token in Settings → API tokens.", message(denied))
        integration(read, post("/api/integration/v1/sections"), mapOf("path" to "Nope")).andExpect(status().isForbidden)
        integration(read, post("/api/integration/v1/test-plans"), mapOf("name" to "Nope")).andExpect(status().isForbidden)
        integration(read, post("/api/integration/v1/results"), mapOf("testCaseNumbers" to listOf(1))).andExpect(status().isOk)

        data(integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Created by an app")))
        assertEquals("co-bord (API token)", appTestCase(1).get("createdBy").asText())

        // revoking stops the token and hides it, but what it created still names it
        val writeID = data(admin.perform(get("/api/v1/workspace/projects/PRJ/api-tokens"))).first { it.get("canWrite").asBoolean() }.get("tokenID").asText()
        send(delete("/api/v1/workspace/api-tokens/$writeID"), null).andExpect(status().isOk)
        integration(write, get("/api/integration/v1/project")).andExpect(status().isUnauthorized)
        assertEquals(1, data(admin.perform(get("/api/v1/workspace/projects/PRJ/api-tokens"))).size())
        send(delete("/api/v1/workspace/api-tokens/$writeID"), null).andExpect(status().isBadRequest)
        assertEquals("co-bord (API token)", appTestCase(1).get("createdBy").asText())
    }

    @Test
    fun `creates sections, test cases and plans, once per sourceRef`() {
        val write = token("PRJ", canWrite = true)

        // sections by path, reusing the parts that exist, ignoring case
        val cards = data(integration(write, post("/api/integration/v1/sections"), mapOf("path" to "Checkout / Payments / Cards")))
        assertEquals("Checkout / Payments / Cards", cards.get("path").asText())
        val again = data(integration(write, post("/api/integration/v1/sections"), mapOf("path" to " checkout/payments / CARDS ")))
        assertEquals(cards.get("sectionID").asText(), again.get("sectionID").asText())

        // a text test case, with labels cleaned like in the app
        val text = data(integration(write, post("/api/integration/v1/test-cases"), mapOf(
            "title" to "Pay with a saved card", "description" to "From the checkout flow", "testInstructions" to "Pay and check the receipt",
            "sectionPath" to "Checkout / Payments", "labels" to listOf("Smoke", "smoke", " web "), "sourceRef" to "cobord:board:1",
        )))
        assertEquals(1, text.get("testCaseNumber").asInt())
        assertTrue(text.get("created").asBoolean())
        assertEquals("Checkout / Payments", text.get("sectionPath").asText())
        assertEquals(listOf("Smoke", "web"), text.get("labels").map { it.asText() })
        assertEquals("/test-cases/PRJ/1", text.get("webPath").asText())
        assertEquals("cobord:board:1", text.get("sourceRef").asText())

        // the same reference again returns the first test case instead of creating another
        val repeated = data(integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Another title", "sourceRef" to "cobord:board:1")))
        assertEquals(1, repeated.get("testCaseNumber").asInt())
        assertFalse(repeated.get("created").asBoolean())

        // a test case written as steps, in the first suite when no section is given
        val steps = data(integration(write, post("/api/integration/v1/test-cases"), mapOf(
            "title" to "Refund an order", "format" to "STEPS",
            "steps" to listOf(mapOf("action" to "Open the order", "expected" to "The order page opens"), mapOf("action" to "Click Refund")),
        )))
        assertEquals(2, steps.get("testCaseNumber").asInt())
        val appSteps = appTestCase(2)
        assertEquals("STEPS", appSteps.get("format").asText())
        assertEquals(listOf("Open the order", "Click Refund"), appSteps.get("steps").map { it.get("action").asText() })
        // the project's first suite: Checkout, created above
        assertEquals("Checkout", steps.get("sectionPath").asText())
        // credited to the token, and the required properties take their defaults
        assertEquals("co-bord (API token)", appSteps.get("createdBy").asText())
        assertTrue(appSteps.get("updatedBy")?.isNull ?: true)
        val required = data(admin.perform(get("/api/v1/workspace/properties"))).filter { it.get("isRequired").asBoolean() }
        required.forEach { assertEquals(it.get("defaultValue").asText(), appSteps.get("propertyValues").get(it.get("propertyConfigurationID").asText()).asText()) }

        // plans by section, label and test case number, once per reference
        val plan = data(integration(write, post("/api/integration/v1/test-plans"), mapOf(
            "name" to "Checkout flow", "sectionIDs" to listOf(cards.get("sectionID").asText()), "labels" to listOf("smoke"),
            "testCaseNumbers" to listOf(2), "sourceRef" to "cobord:board:flow",
        )))
        assertTrue(plan.get("created").asBoolean())
        assertEquals(2, plan.get("testCaseCount").asInt())
        val planAgain = data(integration(write, post("/api/integration/v1/test-plans"), mapOf("name" to "Other", "testCaseNumbers" to listOf(1), "sourceRef" to "cobord:board:flow")))
        assertEquals(plan.get("testPlanID").asText(), planAgain.get("testPlanID").asText())
        assertFalse(planAgain.get("created").asBoolean())
        val appPlans = data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-plans")))
        assertEquals(1, appPlans.size())
        assertEquals("co-bord (API token)", appPlans[0].get("createdBy").asText())

        // the reference of an archived test case can be used again
        val testCaseID = appTestCase(1).get("testCaseID").asText()
        createRun(1, createBuild("1.0"), testCaseID to TestCaseRunStatus.PASS)
        send(delete("/api/v1/workspace/test-cases/$testCaseID"), null).andExpect(status().isOk)
        val recreated = data(integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Pay with a saved card", "sourceRef" to "cobord:board:1")))
        assertTrue(recreated.get("created").asBoolean())
        assertEquals(3, recreated.get("testCaseNumber").asInt())
    }

    @Test
    fun `requests with the same sourceRef at once create one test case`() {
        val write = token("PRJ", canWrite = true)
        val pool = java.util.concurrent.Executors.newFixedThreadPool(6)
        val answers = (1..6).map {
            pool.submit<JsonNode> {
                data(integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Rule fired twice", "sourceRef" to "cobord:rule:7")))
            }
        }.map { it.get() }
        pool.shutdown()
        assertEquals(setOf(1), answers.map { it.get("testCaseNumber").asInt() }.toSet())
        assertEquals(1, answers.count { it.get("created").asBoolean() })
        assertEquals(1, data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).size())
    }

    @Test
    fun `writing validates like the app and stays in the token's project`() {
        val write = token("PRJ", canWrite = true)
        fun rejected(path: String, body: Any) = message(integration(write, post("/api/integration/v1/$path"), body).andExpect(status().isBadRequest))

        assertEquals("Give the test case a title", rejected("test-cases", mapOf("title" to " ")))
        assertEquals("The title can have up to 500 characters", rejected("test-cases", mapOf("title" to "x".repeat(501))))
        assertEquals("The format must be TEXT or STEPS", rejected("test-cases", mapOf("title" to "A", "format" to "TABLE")))
        assertTrue(rejected("test-cases", mapOf("title" to "A", "format" to "TEXT", "steps" to listOf(mapOf("action" to "Go")))).contains("STEPS format"))
        rejected("test-cases", mapOf("title" to "A", "format" to "STEPS"))
        rejected("test-cases", mapOf("title" to "A", "steps" to listOf(mapOf("expected" to "No action"))))
        assertTrue(rejected("test-cases", mapOf("title" to "A", "labels" to listOf("x".repeat(51)))).contains("50 characters"))
        assertTrue(rejected("test-cases", mapOf("title" to "A", "sourceRef" to "x".repeat(201))).contains("200 characters"))
        assertEquals("The request body isn't valid JSON, or a field has the wrong type", rejected("test-cases", mapOf("title" to listOf("A"))))

        assertTrue(rejected("sections", mapOf("path" to " / ")).isNotEmpty())
        assertTrue(rejected("sections", mapOf("path" to "x".repeat(201))).contains("200 characters"))

        assertEquals("The test plan needs a name", rejected("test-plans", mapOf("name" to " ", "testCaseNumbers" to listOf(1))))
        assertTrue(rejected("test-plans", mapOf("name" to "Empty")).startsWith("Choose the test cases"))
        assertEquals("No test case #999 in this project", rejected("test-plans", mapOf("name" to "Missing", "testCaseNumbers" to listOf(999))))
        // nothing was created by the rejected requests
        assertEquals(0, data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).size())

        // each project's token creates in its own project, and references don't collide between projects
        val other = token("OTH", canWrite = true)
        val otherSection = data(integration(other, post("/api/integration/v1/sections"), mapOf("path" to "Elsewhere"))).get("sectionID").asText()
        assertTrue(data(integration(other, post("/api/integration/v1/test-cases"), mapOf("title" to "Theirs", "sourceRef" to "shared"))).get("created").asBoolean())
        assertTrue(data(integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Ours", "sourceRef" to "shared"))).get("created").asBoolean())
        assertEquals(listOf("Ours"), data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).map { it.get("title").asText() })
        assertTrue(rejected("test-plans", mapOf("name" to "Theirs", "sectionIDs" to listOf(otherSection))).startsWith("No section found"))
    }

    private fun token(shortCode: String, canWrite: Boolean = false): String =
        data(send(post("/api/v1/workspace/projects/$shortCode/api-tokens"), mapOf("name" to "co-bord", "canWrite" to canWrite))).get("secret").asText()

    private fun appTestCase(number: Int): JsonNode =
        data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).first { it.get("testCaseNumber").asInt() == number }

    private fun message(result: ResultActions): String =
        objectMapper.readTree(result.andReturn().response.contentAsString).get("message").asText()

    private fun integration(secret: String, request: MockHttpServletRequestBuilder, body: Any? = null): ResultActions {
        request.header(HttpHeaders.AUTHORIZATION, "Bearer $secret").contentType(MediaType.APPLICATION_JSON)
        if (body != null) request.content(objectMapper.writeValueAsString(body))
        return anonymous.perform(request)
    }

    private fun createSection(name: String, parentID: String?): String =
        data(send(post("/api/v1/workspace/projects/PRJ/sections"), mapOf("name" to name, "parentID" to parentID))).get("sectionID").asText()

    private fun createTestCase(title: String, sectionID: String?, labels: List<String>): String {
        send(post("/api/v1/workspace/test-cases/PRJ"), testCaseDTO(title, sectionID, labels)).andExpect(status().isOk)
        return data(admin.perform(get("/api/v1/workspace/test-cases/PRJ"))).last().get("testCaseID").asText()
    }

    private fun testCaseDTO(title: String, sectionID: String?, labels: List<String>): CreateTestCaseDTO {
        val values = data(admin.perform(get("/api/v1/workspace/properties")))
            .filter { it.get("isRequired").asBoolean() }
            .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
        return CreateTestCaseDTO(title, null, null, values, sectionID?.let { UUID.fromString(it) }, labels = labels)
    }

    private fun createBuild(number: String): String =
        data(send(post("/api/v1/workspace/projects/PRJ/builds"), mapOf("buildNumber" to number))).get("buildID").asText()

    /** A test run with the given test cases and results (null leaves one pending). */
    private fun createRun(number: Int, buildID: String, vararg results: Pair<String, TestCaseRunStatus?>) {
        send(post("/api/v1/workspace/test-runs/PRJ"), CreateTestRunDTO("Run $number", null, results.map { UUID.fromString(it.first) }, buildID = UUID.fromString(buildID)))
            .andExpect(status().isOk)
        val runs = data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/$number")))
        for ((testCaseID, result) in results) {
            if (result == null) continue
            val run = runs.first { it.get("testCase").get("testCaseID").asText() == testCaseID }
            send(put("/api/v1/workspace/test-case-runs/${run.get("testCaseRunID").asText()}"), UpdateTestCaseRunDTO(result, null)).andExpect(status().isOk)
        }
    }

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
