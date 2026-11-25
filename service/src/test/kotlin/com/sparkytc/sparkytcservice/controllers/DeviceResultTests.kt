package com.sparkytc.sparkytcservice.controllers

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.CreateTestRunDTO
import com.sun.net.httpserver.HttpServer
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
import java.net.InetSocketAddress
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The device a result was recorded on, read from a SparkStock stand-in. */
@SpringBootTest
@Testcontainers
class DeviceResultTests {

    /** Answers SparkStock's integration API: two headsets, VR-0001 on loan to `holder`. */
    object FakeSparkStock {
        const val TOKEN = "stock-test-token"
        @Volatile var down = false
        @Volatile var holder: String? = null
        @Volatile var lastQuery: String? = null

        private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/api/integration/v1/devices") { exchange ->
                val path = exchange.requestURI.path
                lastQuery = exchange.requestURI.query
                val (code, body) = when {
                    down -> 503 to """{"status":"ERROR","message":"down"}"""
                    exchange.requestHeaders.getFirst("Authorization") != "Bearer $TOKEN" -> 401 to """{"status":"ERROR","message":"bad token"}"""
                    path.endsWith("/VR-0001") -> 200 to """{"status":"SUCCESS","data":${headset1()}}"""
                    path.endsWith("/VR-0002") -> 200 to """{"status":"SUCCESS","data":${headset2()}}"""
                    path == "/api/integration/v1/devices" -> {
                        val mine = exchange.requestURI.query?.contains("holderUserID=") == true
                        200 to """{"status":"SUCCESS","data":[${if (mine) headset1() else headset1() + "," + headset2()}]}"""
                    }
                    else -> 404 to """{"status":"ERROR","message":"No device has the tag"}"""
                }
                val bytes = body.toByteArray()
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(code, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
            start()
        }

        private fun headset1() = """{"ref":"VR-0001","name":"VR Headset 1","model":"Focus 3","version":"SKQ1.230810.001","status":"ON_LOAN","holderUserID":${holder?.let { "\"$it\"" }},"extra":"ignored"}"""
        private fun headset2() = """{"ref":"VR-0002","name":"VR Headset 2","model":"XR Elite","version":"6.0","status":"AVAILABLE"}"""

        val url get() = "http://127.0.0.1:${server.address.port}"
    }

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
            registry.add("sparkytc.stock.api-url") { FakeSparkStock.url }
            registry.add("sparkytc.stock.integration-token") { FakeSparkStock.TOKEN }
        }
    }

    @Autowired private lateinit var databaseMigrator: DatabaseMigrator
    @Autowired private lateinit var adminBootstrap: AdminBootstrap
    @Autowired private lateinit var context: WebApplicationContext
    @Autowired private lateinit var objectMapper: ObjectMapper

    private lateinit var admin: MockMvc

    @BeforeEach
    fun beforeEach() {
        databaseMigrator.run()
        adminBootstrap.run()
        FakeSparkStock.down = false
        admin = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper))
        send(post("/api/v1/workspace/projects"), CreateWorkspaceProjectDTO(title = "VR game", projectShortCode = "VR", description = null))
        val values = data(admin.perform(get("/api/v1/workspace/properties")))
            .filter { it.get("isRequired").asBoolean() }
            .associate { UUID.fromString(it.get("propertyConfigurationID").asText()) to it.get("defaultValue").asText() }
        send(post("/api/v1/workspace/test-cases/VR"), CreateTestCaseDTO("Grab an object", null, null, values)).andExpect(status().isOk)
    }

    private fun setMode(mode: String) =
        send(put("/api/v1/workspace/projects/VR/settings"), mapOf("jiraFailureMode" to "MANUAL", "jiraProjectKey" to null, "deviceMode" to mode))
            .andExpect(status().isOk)

    private fun createRun(): String {
        val testCaseID = data(admin.perform(get("/api/v1/workspace/test-cases/VR")))[0].get("testCaseID").asText()
        send(post("/api/v1/workspace/test-runs/VR"), CreateTestRunDTO("Run", null, listOf(UUID.fromString(testCaseID)))).andExpect(status().isOk)
        val runs = data(admin.perform(get("/api/v1/workspace/test-runs/VR")))
        val number = runs.maxOf { it.get("testRunNumber").asInt() }
        return data(admin.perform(get("/api/v1/workspace/test-case-runs/VR/$number")))[0].get("testCaseRunID").asText()
    }

    private fun record(testCaseRunID: String, deviceRef: String?) =
        send(put("/api/v1/workspace/test-case-runs/$testCaseRunID"), mapOf("status" to "PASS", "notes" to null, "deviceRef" to deviceRef))

    private fun caseRun(testCaseRunID: String): JsonNode {
        val runs = data(admin.perform(get("/api/v1/workspace/test-runs/VR")))
        return runs.flatMap { data(admin.perform(get("/api/v1/workspace/test-case-runs/VR/${it.get("testRunNumber").asInt()}"))) }
            .first { it.get("testCaseRunID").asText() == testCaseRunID }
    }

    @Test
    fun `the project setting is off by default and saved with the other settings`() {
        val project = data(admin.perform(get("/api/v1/workspace/projects"))).first { it.get("projectShortCode").asText() == "VR" }
        assertEquals("OFF", project.get("deviceMode").asText())
        setMode("REQUIRED")
        val saved = data(admin.perform(get("/api/v1/workspace/projects"))).first { it.get("projectShortCode").asText() == "VR" }
        assertEquals("REQUIRED", saved.get("deviceMode").asText())
        // saving Jira settings without the field keeps the mode
        send(put("/api/v1/workspace/projects/VR/settings"), mapOf("jiraFailureMode" to "MANUAL", "jiraProjectKey" to null)).andExpect(status().isOk)
        assertEquals("REQUIRED", data(admin.perform(get("/api/v1/workspace/projects"))).first { it.get("projectShortCode").asText() == "VR" }.get("deviceMode").asText())
    }

    @Test
    fun `with the setting off the device is ignored`() {
        val run = createRun()
        record(run, "VR-0001").andExpect(status().isOk)
        assertNull(caseRun(run).get("device"))
    }

    @Test
    fun `a result keeps a copy of the device from SparkStock`() {
        setMode("OPTIONAL")
        val run = createRun()
        record(run, null).andExpect(status().isOk) // optional
        record(run, "VR-0001").andExpect(status().isOk)

        val caseRun = caseRun(run)
        val device = caseRun.get("device")
        assertEquals("VR-0001", device.get("ref").asText())
        assertEquals("VR Headset 1", device.get("name").asText())
        assertEquals("Focus 3", device.get("model").asText())
        assertEquals("SKQ1.230810.001", device.get("version").asText())
        val results = caseRun.get("results")
        assertFalse(results[0].has("device"))
        assertEquals("VR-0001", results[1].get("device").get("ref").asText())

        // the history shows it too
        val testCaseID = caseRun.get("testCase").get("testCaseID").asText()
        val history = data(admin.perform(get("/api/v1/workspace/test-cases/$testCaseID/history")))
        assertEquals("VR-0001", history[0].get("result").get("device").get("ref").asText())
    }

    @Test
    fun `required mode asks for a device SparkStock knows`() {
        setMode("REQUIRED")
        val run = createRun()
        assertEquals("Choose the device you tested on", message(record(run, " ").andExpect(status().isBadRequest)))
        assertEquals("SparkStock has no device with the tag VR-0404", message(record(run, "VR-0404").andExpect(status().isBadRequest)))
        assertEquals("PENDING", caseRun(run).get("status").asText())
        record(run, "VR-0002").andExpect(status().isOk)
        assertEquals("XR Elite", caseRun(run).get("device").get("model").asText())
    }

    @Test
    fun `when SparkStock is down the typed tag is kept`() {
        setMode("REQUIRED")
        val run = createRun()
        FakeSparkStock.down = true
        record(run, "vr-0001").andExpect(status().isOk)
        val device = caseRun(run).get("device")
        assertEquals("VR-0001", device.get("ref").asText())
        assertFalse(device.has("model"))
    }

    @Test
    fun `the picker lists the tester's devices or searches all of them`() {
        val me = data(admin.perform(get("/api/v1/auth/me"))).get("userID").asText()
        FakeSparkStock.holder = me
        assertTrue(data(admin.perform(get("/api/v1/workspace/stock/configuration"))).get("isEnabled").asBoolean())
        val mine = data(admin.perform(get("/api/v1/workspace/stock/devices?mine=true")))
        assertEquals(1, mine.size())
        assertTrue(FakeSparkStock.lastQuery!!.contains("holderUserID=$me"))
        assertEquals(me, mine[0].get("holderUserID").asText())
        assertEquals(2, data(admin.perform(get("/api/v1/workspace/stock/devices?q=vive"))).size())
        assertEquals("q=vive", FakeSparkStock.lastQuery)

        FakeSparkStock.down = true
        admin.perform(get("/api/v1/workspace/stock/devices")).andExpect(status().isBadGateway)
    }

    @Test
    fun `apps send the device with results through the integration API`() {
        send(post("/api/v1/workspace/projects/VR/builds"), mapOf("buildNumber" to "1.0")).andExpect(status().isOk)
        val write = data(send(post("/api/v1/workspace/projects/VR/api-tokens"), mapOf("name" to "re-Play", "canWrite" to true))).get("secret").asText()
        fun integration(request: MockHttpServletRequestBuilder, body: Any): ResultActions = admin.perform(
            request.header(HttpHeaders.AUTHORIZATION, "Bearer $write").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
        )
        integration(post("/api/integration/v1/test-runs"), mapOf("title" to "Replay", "build" to "1.0", "testCaseNumbers" to listOf(1))).andExpect(status().isOk)

        // the project's mode doesn't apply to apps, an unknown device does
        assertEquals("SparkStock has no device with the tag NOPE-1",
            message(integration(post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS", "deviceRef" to "NOPE-1")).andExpect(status().isBadRequest)))
        integration(post("/api/integration/v1/test-runs/1/results"), mapOf("testCaseNumber" to 1, "status" to "PASS", "deviceRef" to "VR-0002")).andExpect(status().isOk)

        val caseRun = data(admin.perform(get("/api/v1/workspace/test-case-runs/VR/1")))[0]
        assertEquals("VR-0002", caseRun.get("device").get("ref").asText())
        val history = data(integration(get("/api/integration/v1/test-cases/1/history"), emptyMap<String, Any>()))
        assertEquals("6.0", history.get("results")[0].get("device").get("version").asText())
    }

    private fun send(request: MockHttpServletRequestBuilder, body: Any?): ResultActions {
        request.contentType(MediaType.APPLICATION_JSON)
        if (body != null) request.content(objectMapper.writeValueAsString(body))
        return admin.perform(request)
    }

    private fun data(result: ResultActions): JsonNode =
        objectMapper.readTree(result.andExpect(status().isOk).andReturn().response.contentAsString).get("data")

    private fun message(result: ResultActions): String =
        objectMapper.readTree(result.andReturn().response.contentAsString).get("message").asText()
}
