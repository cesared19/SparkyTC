package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.auth.CreateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.CreateTestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestRunStatus
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestRunDTO
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.repositories.ProjectApiTokenRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunDTO
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
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
        private val PNG = byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 13, 10, 26, 10)
        // an empty archive: just the end of central directory record
        private val ZIP = byteArrayOf('P'.code.toByte(), 'K'.code.toByte(), 5, 6) + ByteArray(18)

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
    @Autowired private lateinit var projectRepository: WorkspaceProjectRepository
    @Autowired private lateinit var tokenRepository: ProjectApiTokenRepository
    @Autowired private lateinit var testRunRepository: TestRunRepository

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

    @Test
    fun `reads a test case's history, newest first, with how each step went`() {
        val secret = token("PRJ", canWrite = true)
        val created = data(integration(secret, post("/api/integration/v1/test-cases"), mapOf(
            "title" to "Sign in", "description" to "With a password",
            "steps" to listOf(mapOf("action" to "Open the app", "expected" to "The sign in page"), mapOf("action" to "Sign in")),
        )))
        val number = created.get("testCaseNumber").asInt()
        val testCaseID = created.get("testCaseID").asText()
        val build = createBuild("2.0")
        createRun(1, build, testCaseID to TestCaseRunStatus.FAIL)
        // a second result in another run, with the steps recorded
        send(post("/api/v1/workspace/test-runs/PRJ"), CreateTestRunDTO("Run 2", null, listOf(UUID.fromString(testCaseID)), buildID = UUID.fromString(build)))
            .andExpect(status().isOk)
        val run = data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/2")))[0]
        val runSteps = run.get("steps")
        val stepResults = runSteps.map { StepResultDTO(UUID.fromString(it.get("stepID").asText()), TestCaseRunStatus.PASS, "As expected") }
        send(put("/api/v1/workspace/test-case-runs/${run.get("testCaseRunID").asText()}"), UpdateTestCaseRunDTO(TestCaseRunStatus.PASS, "Works now", stepResults = stepResults))
            .andExpect(status().isOk)

        val history = data(integration(secret, get("/api/integration/v1/test-cases/$number/history")))
        assertEquals("Sign in", history.get("testCase").get("title").asText())
        assertEquals("With a password", history.get("description").asText())
        assertEquals("STEPS", history.get("format").asText())
        assertEquals(listOf("Open the app", "Sign in"), history.get("steps").map { it.get("action").asText() })
        assertEquals(2, history.get("total").asInt())
        val results = history.get("results")
        assertEquals(listOf("PASS", "FAIL"), results.map { it.get("status").asText() })
        assertEquals(listOf(2, 1), results.map { it.get("testRunNumber").asInt() })
        assertEquals("2.0", results[0].get("buildNumber").asText())
        assertEquals("Works now", results[0].get("notes").asText())
        assertTrue(results[0].get("isLatestInRun").asBoolean())
        assertEquals("/test-runs/PRJ/2/$number", results[0].get("webPath").asText())
        assertEquals(listOf("PASS", "PASS"), results[0].get("steps").map { it.get("status").asText() })
        assertEquals("The sign in page", results[0].get("steps")[0].get("expected").asText())
        assertEquals(1, data(integration(secret, get("/api/integration/v1/test-cases/$number/history").param("limit", "1"))).get("results").size())

        // a number that isn't there, or is in another project, is not found
        integration(secret, get("/api/integration/v1/test-cases/99/history")).andExpect(status().isNotFound)
        integration(token("OTH"), get("/api/integration/v1/test-cases/$number/history")).andExpect(status().isNotFound)
    }

    @Test
    fun `test runs created in the app are manual and runs a token created are automated`() {
        val testCaseID = createTestCase("Login", null, emptyList())
        send(post("/api/v1/workspace/test-runs/PRJ"), CreateTestRunDTO("Manual run", null, listOf(UUID.fromString(testCaseID))))
            .andExpect(status().isOk)

        // a run created the way the integration API creates them
        val project = projectRepository.findByProjectShortCode("PRJ")!!
        token("PRJ", canWrite = true)
        val apiToken = tokenRepository.findAllByProjectAndRevokedAtIsNullOrderByCreationDateDesc(project).first()
        testRunRepository.save(TestRun(
            project = project, testRunNumber = 2, status = TestRunStatus.PENDING, title = "Replay",
            description = null, isAutomated = true, createdByToken = apiToken,
        ))

        val runs = data(admin.perform(get("/api/v1/workspace/test-runs/PRJ")))
        val manual = runs.first { it.get("title").asText() == "Manual run" }
        assertFalse(manual.get("automated").asBoolean())
        assertFalse(manual.get("createdBy").asText().endsWith("(API token)"))
        val automated = runs.first { it.get("title").asText() == "Replay" }
        assertTrue(automated.get("automated").asBoolean())
        assertEquals("co-bord (API token)", automated.get("createdBy").asText())
        assertTrue(data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-runs/2"))).get("automated").asBoolean())

        // editing it in the app (even sending the flag) doesn't make it manual
        val update = objectMapper.valueToTree<com.fasterxml.jackson.databind.node.ObjectNode>(UpdateTestRunDTO("Replay, checked", null, TestRunStatus.IN_PROGRESS))
            .put("automated", false)
        send(put("/api/v1/workspace/test-runs/${automated.get("testRunID").asText()}"), update).andExpect(status().isOk)
        val edited = data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-runs/2")))
        assertEquals("Replay, checked", edited.get("title").asText())
        assertTrue(edited.get("automated").asBoolean())

        // and revoking the token keeps both the flag and the author
        send(delete("/api/v1/workspace/api-tokens/${apiToken.externalID}"), null).andExpect(status().isOk)
        val afterRevoke = data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-runs/2")))
        assertTrue(afterRevoke.get("automated").asBoolean())
        assertEquals("co-bord (API token)", afterRevoke.get("createdBy").asText())
    }

    @Test
    fun `creates automated test runs for a registered build, once per sourceRef`() {
        val write = token("PRJ", canWrite = true)
        // 1 and 2 are in a nested section of Menus; 3 is elsewhere
        for (title in listOf("Open the main menu", "Close the main menu")) {
            integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to title, "sectionPath" to "Menus / Main")).andExpect(status().isOk)
        }
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Grab a cube", "sectionPath" to "Objects")).andExpect(status().isOk)
        val menus = data(integration(write, get("/api/integration/v1/sections"))).first { it.get("path").asText() == "Menus" }.get("sectionID").asText()
        val plan = data(integration(write, post("/api/integration/v1/test-plans"), mapOf("name" to "Menus", "sectionIDs" to listOf(menus)))).get("testPlanID").asText()
        createBuild("1.4.2")

        // test cases by number and a plan's, without repeating and in number order
        val run = data(integration(write, post("/api/integration/v1/test-runs"), mapOf(
            "title" to "Replay smoke", "description" to "From re-Play", "build" to " 1.4.2 ",
            "testCaseNumbers" to listOf(3, 1), "testPlanID" to plan, "sourceRef" to "replay:batch:1",
        )))
        assertTrue(run.get("created").asBoolean())
        assertTrue(run.get("automated").asBoolean())
        assertEquals(1, run.get("testRunNumber").asInt())
        assertEquals("PENDING", run.get("status").asText())
        assertEquals("1.4.2", run.get("build").get("buildNumber").asText())
        assertEquals(plan, run.get("testPlanID").asText())
        assertEquals("/test-runs/PRJ/1", run.get("webPath").asText())
        assertEquals("replay:batch:1", run.get("sourceRef").asText())
        assertEquals(listOf(1, 2, 3), run.get("testCases").map { it.get("testCaseNumber").asInt() })
        assertEquals(setOf("NOT_RUN"), run.get("testCases").map { it.get("status").asText() }.toSet())
        assertEquals("/test-runs/PRJ/1/2", run.get("testCases")[1].get("webPath").asText())

        // in the app: automated, credited to the token, open and with nobody assigned
        val appRun = data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-runs/1")))
        assertTrue(appRun.get("automated").asBoolean())
        assertEquals("co-bord (API token)", appRun.get("createdBy").asText())
        assertEquals(0, appRun.get("assignees").size())
        assertEquals("From re-Play", appRun.get("description").asText())
        assertEquals(3, data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/1"))).size())

        // the same reference returns that run instead of creating another
        val again = data(integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Other", "build" to "1.4.2", "testCaseNumbers" to listOf(2), "sourceRef" to "replay:batch:1")))
        assertFalse(again.get("created").asBoolean())
        assertEquals(1, again.get("testRunNumber").asInt())
        assertEquals(3, again.get("testCases").size())

        // only the plan's test cases (the nested section counts), and without a reference a new run each time
        val byPlan = data(integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Menus only", "build" to "1.4.2", "testPlanID" to plan)))
        assertEquals(2, byPlan.get("testRunNumber").asInt())
        assertEquals(listOf(1, 2), byPlan.get("testCases").map { it.get("testCaseNumber").asInt() })
        assertEquals(2, data(admin.perform(get("/api/v1/workspace/test-runs/PRJ"))).size())
    }

    @Test
    fun `creating a test run checks the token, the build and the test cases first`() {
        val write = token("PRJ", canWrite = true)
        fun rejected(body: Any) = message(integration(write, post("/api/integration/v1/test-runs"), body).andExpect(status().isBadRequest))
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Open the main menu")).andExpect(status().isOk)
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Old case")).andExpect(status().isOk)
        val buildID = createBuild("1.4.2")
        // #2 is archived: deleted after being used in a run
        val oldCase = appTestCase(2).get("testCaseID").asText()
        createRun(1, buildID, oldCase to TestCaseRunStatus.PASS)
        send(delete("/api/v1/workspace/test-cases/$oldCase"), null).andExpect(status().isOk)

        // a Read token can't create test runs
        integration(token("PRJ"), post("/api/integration/v1/test-runs"), mapOf("title" to "Run", "build" to "1.4.2", "testCaseNumbers" to listOf(1)))
            .andExpect(status().isForbidden)

        assertEquals("Give the test run a title", rejected(mapOf("title" to " ", "build" to "1.4.2", "testCaseNumbers" to listOf(1))))
        assertTrue(rejected(mapOf("title" to "Run", "testCaseNumbers" to listOf(1))).startsWith("Send the build"))
        assertEquals("No build 9.9.9 in this project. An admin registers builds in the Builds tab.",
            rejected(mapOf("title" to "Run", "build" to "9.9.9", "testCaseNumbers" to listOf(1))))
        assertEquals("Send testCaseNumbers, a testPlanID, or both", rejected(mapOf("title" to "Run", "build" to "1.4.2")))
        assertEquals("No test case #2, #99 in this project (or archived)",
            rejected(mapOf("title" to "Run", "build" to "1.4.2", "testCaseNumbers" to listOf(1, 2, 99))))
        val unknownPlan = UUID.randomUUID()
        assertEquals("No test plan $unknownPlan in this project", rejected(mapOf("title" to "Run", "build" to "1.4.2", "testPlanID" to unknownPlan)))

        // another project's token sees neither this project's plans nor its builds
        val plan = data(integration(write, post("/api/integration/v1/test-plans"), mapOf("name" to "Smoke", "testCaseNumbers" to listOf(1)))).get("testPlanID").asText()
        val other = token("OTH", canWrite = true)
        val otherRejected = message(integration(other, post("/api/integration/v1/test-runs"), mapOf("title" to "Run", "build" to "1.4.2", "testPlanID" to plan))
            .andExpect(status().isBadRequest))
        assertTrue(otherRejected.startsWith("No build 1.4.2"))

        // only the run created in the app exists: nothing was created by the rejected requests
        val runs = data(admin.perform(get("/api/v1/workspace/test-runs/PRJ")))
        assertEquals(1, runs.size())
        assertFalse(runs[0].get("automated").asBoolean())
    }

    @Test
    fun `requests with the same sourceRef at once create one test run`() {
        val write = token("PRJ", canWrite = true)
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Open the main menu")).andExpect(status().isOk)
        createBuild("1.4.2")
        val pool = java.util.concurrent.Executors.newFixedThreadPool(6)
        val answers = (1..6).map {
            pool.submit<JsonNode> {
                data(integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.4.2", "testCaseNumbers" to listOf(1), "sourceRef" to "replay:batch:7")))
            }
        }.map { it.get() }
        pool.shutdown()
        assertEquals(setOf(1), answers.map { it.get("testRunNumber").asInt() }.toSet())
        assertEquals(1, answers.count { it.get("created").asBoolean() })
        assertEquals(1, data(admin.perform(get("/api/v1/workspace/test-runs/PRJ"))).size())
    }

    @Test
    fun `records results in automated test runs like the app, with the time and the report`() {
        val write = token("PRJ", canWrite = true)
        for (title in listOf("Open the main menu", "Grab a cube", "Teleport")) {
            integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to title)).andExpect(status().isOk)
        }
        createBuild("1.4.2")
        val run = data(integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.4.2", "testCaseNumbers" to listOf(1, 2, 3))))
        assertEquals(1, run.get("testRunNumber").asInt())

        val report = mapOf(
            "passed" to true,
            "findings" to listOf(" p95 frame time went from 11.1 ms to 12.0 ms "),
            "screenshots" to listOf(mapOf("name" to "000120_menu-open", "differentPercent" to 0.02, "passed" to true)),
            "metrics" to mapOf(
                "recorded" to mapOf("averageFps" to 89.6, "frameTimeP95Ms" to 11.1, "droppedFrames" to 3),
                "replay" to mapOf("averageFps" to 88.9, "frameTimeP95Ms" to 12.0, "droppedFrames" to 5),
            ),
        )
        val pass = data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf(
            "testCaseNumber" to 1, "status" to "pass", "notes" to "Replay matched the recording", "durationSeconds" to 95, "report" to report,
        )))
        assertEquals("PASS", pass.get("status").asText())
        assertEquals("IN_PROGRESS", pass.get("testRunStatus").asText())
        assertEquals("/test-runs/PRJ/1/1", pass.get("webPath").asText())
        UUID.fromString(pass.get("resultID").asText())

        // blocked keeps the run open, like in the app
        assertEquals("IN_PROGRESS", data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 2, "status" to "BLOCKED"))).get("testRunStatus").asText())
        assertEquals("IN_PROGRESS", data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 3, "status" to "FAIL"))).get("testRunStatus").asText())
        // a new result for the blocked one completes it
        assertEquals("COMPLETE", data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 2, "status" to "SKIP"))).get("testRunStatus").asText())

        // in the app: the token executed them, with the time it reported, and the run is complete
        val caseRuns = data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/1"))).associateBy { it.get("testCase").get("testCaseNumber").asInt() }
        assertEquals(listOf("PASS", "SKIP", "FAIL"), listOf(1, 2, 3).map { caseRuns.getValue(it).get("status").asText() })
        assertEquals("co-bord (API token)", caseRuns.getValue(1).get("executedBy").asText())
        assertEquals("Replay matched the recording", caseRuns.getValue(1).get("notes").asText())
        assertEquals(95, caseRuns.getValue(1).get("timeSeconds").asInt())
        assertEquals("COMPLETE", data(admin.perform(get("/api/v1/workspace/projects/PRJ/test-runs/1"))).get("status").asText())

        // the history keeps both results of #2 and the report of #1, trimmed and as sent
        val history = data(admin.perform(get("/api/v1/workspace/test-cases/${appTestCase(1).get("testCaseID").asText()}/history")))
        val stored = objectMapper.readTree(history[0].get("result").get("report").asText())
        assertTrue(stored.get("passed").asBoolean())
        assertEquals("p95 frame time went from 11.1 ms to 12.0 ms", stored.get("findings")[0].asText())
        assertEquals("000120_menu-open", stored.get("screenshots")[0].get("name").asText())
        assertEquals(12.0, stored.get("metrics").get("replay").get("frameTimeP95Ms").asDouble())
        assertEquals("co-bord (API token)", history[0].get("result").get("recordedBy").asText())
        assertEquals(2, data(admin.perform(get("/api/v1/workspace/test-cases/${appTestCase(2).get("testCaseID").asText()}/history"))).size())

        // the build's results and the API's history count them like any other
        val results = data(integration(write, post("/api/integration/v1/results"), mapOf("testCaseNumbers" to listOf(1, 2, 3), "build" to "1.4.2")))
        assertEquals(listOf("PASS", "SKIP", "FAIL"), results.get("testCases").map { it.get("status").asText() })
        assertEquals("co-bord (API token)", results.get("testCases")[0].get("executedBy").asText())
        val apiHistory = data(integration(write, get("/api/integration/v1/test-cases/1/history")))
        assertEquals("co-bord (API token)", apiHistory.get("results")[0].get("recordedBy").asText())
    }

    @Test
    fun `recording results needs a write token, an open automated run and its test cases`() {
        val write = token("PRJ", canWrite = true)
        val read = token("PRJ")
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Open the main menu")).andExpect(status().isOk)
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Not in the run")).andExpect(status().isOk)
        val buildID = createBuild("1.4.2")
        data(integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.4.2", "testCaseNumbers" to listOf(1))))
        fun rejected(number: Int, body: Any) = message(integration(write, post("/api/integration/v1/test-runs/$number/results"), body).andExpect(status().isBadRequest))

        // a Read token can't record (its path ends in /results, but only POST /results reads)
        integration(read, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS")).andExpect(status().isForbidden)
        integration(read, post("/api/integration/v1/test-runs/1/results/"), mapOf("testCaseNumber" to 1, "status" to "PASS")).andExpect(status().isForbidden)
        integration(read, post("/api/integration/v1/results"), mapOf("testCaseNumbers" to listOf(1))).andExpect(status().isOk)

        integration(write, post("/api/integration/v1/test-runs/9/results"), mapOf("testCaseNumber" to 1, "status" to "PASS")).andExpect(status().isNotFound)
        assertEquals("Send the testCaseNumber", rejected(1, mapOf("status" to "PASS")))
        assertEquals("The status must be PASS, FAIL, BLOCKED or SKIP", rejected(1, mapOf("testCaseNumber" to 1, "status" to "PENDING")))
        assertEquals("Test case #2 is not in test run 1", rejected(1, mapOf("testCaseNumber" to 2, "status" to "PASS")))
        assertTrue(rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "notes" to "x".repeat(10_001))).contains("10000 characters"))
        assertTrue(rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "durationSeconds" to -1)).startsWith("The durationSeconds"))
        assertTrue(rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "report" to mapOf("findings" to listOf("x".repeat(1_001))))).contains("1000 characters"))
        assertEquals("differentPercent must be between 0 and 100",
            rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "report" to mapOf("screenshots" to listOf(mapOf("name" to "a", "differentPercent" to 150))))))
        assertTrue(rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "report" to mapOf("screenshots" to listOf(mapOf("name" to " ")))))
            .startsWith("Each screenshot needs a name"))
        assertTrue(rejected(1, mapOf("testCaseNumber" to 1, "status" to "PASS", "report" to mapOf("findings" to List(400) { "y".repeat(900) }))).contains("KB"))

        // nothing was recorded by the rejected requests
        assertEquals("PENDING", data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/1")))[0].get("status").asText())

        // runs created in the app are the testers': the API doesn't write in them
        createRun(2, buildID, appTestCase(1).get("testCaseID").asText() to null)
        assertTrue(rejected(2, mapOf("testCaseNumber" to 1, "status" to "PASS")).contains("created in the app"))

        // a closed run takes no more results
        data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS")))
        assertEquals("Test run 1 is closed", rejected(1, mapOf("testCaseNumber" to 1, "status" to "FAIL")))

        // another project's token doesn't see this project's runs
        integration(token("OTH", canWrite = true), post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `attaches images, videos and a downloadable zip report to a result`() {
        val write = token("PRJ", canWrite = true)
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Open the main menu")).andExpect(status().isOk)
        createBuild("1.4.2")
        integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.4.2", "testCaseNumbers" to listOf(1))).andExpect(status().isOk)
        val resultID = data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "FAIL")))
            .get("resultID").asText()

        // after the run completed: evidence goes in once the result is recorded
        val stored = data(upload(write, "/api/integration/v1/test-runs/1/results/$resultID/attachments",
            MockMultipartFile("files", "000120_menu-open.recording.png", "image/png", PNG),
            MockMultipartFile("files", "session.mp4", "video/mp4", byteArrayOf(0, 0, 0, 24)),
            // Windows sends zips with this type
            MockMultipartFile("files", "replay-report.zip", "application/x-zip-compressed", ZIP),
        ))
        assertEquals(listOf("image/png", "video/mp4", "application/zip"), stored.map { it.get("contentType").asText() })

        // in the app: the result's evidence, credited to the token
        val result = data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/1")))[0].get("results").last()
        assertEquals(resultID, result.get("resultID").asText())
        assertEquals(3, result.get("attachments").size())
        assertEquals(setOf("co-bord (API token)"), result.get("attachments").map { it.get("uploadedBy").asText() }.toSet())
        assertEquals(3, data(integration(write, get("/api/integration/v1/test-cases/1/history"))).get("results")[0].get("evidenceCount").asInt())

        // images and videos open in the browser; the zip only downloads, and the browser never guesses its type
        fun served(index: Int) = admin.perform(get("/api/v1/workspace/attachments/${stored[index].get("attachmentID").asText()}")).andExpect(status().isOk).andReturn().response
        assertTrue(served(0).getHeader(HttpHeaders.CONTENT_DISPOSITION)!!.startsWith("inline"))
        assertTrue(served(1).getHeader(HttpHeaders.CONTENT_DISPOSITION)!!.startsWith("inline"))
        val zip = served(2)
        assertTrue(zip.getHeader(HttpHeaders.CONTENT_DISPOSITION)!!.startsWith("attachment"))
        assertEquals("nosniff", zip.getHeader("X-Content-Type-Options"))
        assertEquals("application/zip", zip.contentType)
    }

    @Test
    fun `adding evidence checks the token, the result and the files`() {
        val write = token("PRJ", canWrite = true)
        integration(write, post("/api/integration/v1/test-cases"), mapOf("title" to "Open the main menu")).andExpect(status().isOk)
        val buildID = createBuild("1.4.2")
        integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.4.2", "testCaseNumbers" to listOf(1))).andExpect(status().isOk)
        integration(write, post("/api/integration/v1/test-runs"), mapOf("title" to "Replay 2", "build" to "1.4.2", "testCaseNumbers" to listOf(1))).andExpect(status().isOk)
        val resultID = data(integration(write, post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS"))).get("resultID").asText()
        val path = "/api/integration/v1/test-runs/1/results/$resultID/attachments"
        val png = MockMultipartFile("files", "shot.png", "image/png", PNG)

        upload(token("PRJ"), path, png).andExpect(status().isForbidden)
        upload(write, "/api/integration/v1/test-runs/2/results/$resultID/attachments", png).andExpect(status().isNotFound)
        upload(write, "/api/integration/v1/test-runs/9/results/$resultID/attachments", png).andExpect(status().isNotFound)
        upload(write, "/api/integration/v1/test-runs/1/results/${UUID.randomUUID()}/attachments", png).andExpect(status().isNotFound)
        upload(token("OTH", canWrite = true), path, png).andExpect(status().isNotFound)

        fun rejected(vararg files: MockMultipartFile) = message(upload(write, path, *files).andExpect(status().isBadRequest))
        assertEquals("At least one file is required", rejected())
        assertTrue(rejected(MockMultipartFile("files", "report.html", "text/html", "<script>alert(1)</script>".toByteArray())).startsWith("Unsupported file type for report.html"))
        assertEquals("File fake.zip isn't a .zip file", rejected(MockMultipartFile("files", "fake.zip", "application/zip", "<html>".toByteArray())))
        assertEquals("File empty.png is empty", rejected(MockMultipartFile("files", "empty.png", "image/png", ByteArray(0))))
        // one bad file leaves nothing half uploaded
        rejected(png, MockMultipartFile("files", "notes.txt", "text/plain", "x".toByteArray()))
        assertEquals(0, data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/1")))[0].get("results").last().get("attachments").size())

        // a result of a run created in the app is the testers'
        val appCase = appTestCase(1).get("testCaseID").asText()
        createRun(3, buildID, appCase to TestCaseRunStatus.PASS)
        val appResult = data(admin.perform(get("/api/v1/workspace/test-case-runs/PRJ/3")))[0].get("results").last().get("resultID").asText()
        assertTrue(message(upload(write, "/api/integration/v1/test-runs/3/results/$appResult/attachments", png).andExpect(status().isBadRequest)).contains("created in the app"))

        // in the app, people still upload only images and videos, and an SVG is never shown inline
        admin.perform(multipart("/api/v1/workspace/test-case-results/$appResult/attachments").file(MockMultipartFile("files", "r.zip", "application/zip", ZIP)))
            .andExpect(status().isBadRequest)
        val svg = objectMapper.readTree(admin.perform(multipart("/api/v1/workspace/test-case-results/$appResult/attachments")
            .file(MockMultipartFile("files", "diagram.svg", "image/svg+xml", "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".toByteArray())))
            .andExpect(status().isOk).andReturn().response.contentAsString).get("data")[0].get("attachmentID").asText()
        val served = admin.perform(get("/api/v1/workspace/attachments/$svg")).andExpect(status().isOk).andReturn().response
        assertTrue(served.getHeader(HttpHeaders.CONTENT_DISPOSITION)!!.startsWith("attachment"))
        assertEquals("nosniff", served.getHeader("X-Content-Type-Options"))
    }

    private fun upload(secret: String, path: String, vararg files: MockMultipartFile): ResultActions {
        val request = multipart(path)
        files.forEach { request.file(it) }
        request.header(HttpHeaders.AUTHORIZATION, "Bearer $secret")
        return anonymous.perform(request)
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
