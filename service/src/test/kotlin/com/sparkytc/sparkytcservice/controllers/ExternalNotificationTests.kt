package com.sparkytc.sparkytcservice.controllers

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.sparkytc.sparkytcservice.auth.AdminBootstrap
import com.sparkytc.sparkytcservice.database.DatabaseMigrator
import com.sparkytc.sparkytcservice.dto.auth.CreateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
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

/** Notifications other apps of the suite (SparkStock) put in a user's bell. */
@SpringBootTest
@Testcontainers
class ExternalNotificationTests {
    companion object {
        const val TOKEN = "suite-token"

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
            registry.add("sparkytc.stock.integration-token") { TOKEN }
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
        val username = "tester-${UUID.randomUUID().toString().take(8)}"
        admin.perform(post("/api/v1/admin/users").contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(CreateUserDTO(username, "Tom Tester", UserRole.TESTER, "tester-password"))))
            .andExpect(status().isOk)
        tester = TestAuth.authenticatedMockMvc(context, TestAuth.login(context, objectMapper, username, "tester-password"))
        testerID = data(tester.perform(get("/api/v1/auth/me"))).get("userID").asText()
    }

    private fun send(body: Map<String, Any?>, token: String? = TOKEN): ResultActions {
        val request = post("/api/system/v1/notifications").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
        token?.let { request.header(HttpHeaders.AUTHORIZATION, "Bearer $it") }
        return TestAuth.anonymousMockMvc(context).perform(request)
    }

    private fun reminder(sourceRef: String = "sparkstock:overdue:VR-0001:2026-12-02") = mapOf(
        "userID" to testerID, "app" to "SparkStock", "title" to "Return VR-0001",
        "message" to "VR Headset 1 was due on Dec 2.", "link" to "http://10.0.0.5:3100/t/VR-0001", "sourceRef" to sourceRef,
    )

    private fun bell(user: MockMvc) = data(user.perform(get("/api/v1/notifications")))

    @Test
    fun `needs the suite's token, not a session or a project token`() {
        send(reminder(), token = null).andExpect(status().isUnauthorized)
        send(reminder(), token = "wrong").andExpect(status().isUnauthorized)
        val session = TestAuth.login(context, objectMapper)
        send(reminder(), token = session).andExpect(status().isUnauthorized)
        assertEquals(0, bell(tester).get("unreadCount").asInt())
    }

    @Test
    fun `puts the notification in the user's bell once per sourceRef`() {
        val first = data(send(reminder()).andExpect(status().isOk))
        assertTrue(first.get("created").asBoolean())
        val again = data(send(reminder()).andExpect(status().isOk))
        assertFalse(again.get("created").asBoolean())
        assertEquals(first.get("notificationID").asText(), again.get("notificationID").asText())
        send(reminder("sparkstock:overdue:VR-0001:2026-12-03")).andExpect(status().isOk)

        val bell = bell(tester)
        assertEquals(2, bell.get("unreadCount").asInt())
        val notification = bell.get("notifications")[1]
        assertEquals("EXTERNAL", notification.get("type").asText())
        assertEquals("SparkStock", notification.get("appName").asText())
        assertEquals("Return VR-0001", notification.get("title").asText())
        assertEquals("http://10.0.0.5:3100/t/VR-0001", notification.get("link").asText())
        // only the user's own bell
        assertEquals(0, bell(admin).get("unreadCount").asInt())
    }

    @Test
    fun `checks the request`() {
        fun rejected(body: Map<String, Any?>) =
            objectMapper.readTree(send(body).andExpect(status().isBadRequest).andReturn().response.contentAsString).get("message").asText()
        assertEquals("Send a title", rejected(reminder() + ("title" to " ")))
        assertEquals("The link must be an http or https address", rejected(reminder() + ("link" to "javascript:alert(1)")))
        assertEquals("Send the app's name", rejected(reminder() - "app"))
        send(reminder() + ("userID" to UUID.randomUUID().toString())).andExpect(status().isNotFound)
    }

    @Test
    fun `users can turn these notifications off`() {
        assertTrue(data(tester.perform(get("/api/v1/auth/me"))).get("notifyExternal").asBoolean())
        tester.perform(put("/api/v1/auth/preferences/notifications").contentType(MediaType.APPLICATION_JSON)
            .content("""{"testRunAssigned":true,"testRunCompleted":true,"external":false}""")).andExpect(status().isOk)
        assertFalse(data(tester.perform(get("/api/v1/auth/me"))).get("notifyExternal").asBoolean())

        val result = data(send(reminder()).andExpect(status().isOk))
        assertFalse(result.get("created").asBoolean())
        assertEquals("The user turned off notifications from other apps", result.get("skipped").asText())
        assertEquals(0, bell(tester).get("unreadCount").asInt())

        // saving the other preferences without the field keeps it off
        tester.perform(put("/api/v1/auth/preferences/notifications").contentType(MediaType.APPLICATION_JSON)
            .content("""{"testRunAssigned":false,"testRunCompleted":true}""")).andExpect(status().isOk)
        assertFalse(data(tester.perform(get("/api/v1/auth/me"))).get("notifyExternal").asBoolean())
    }

    private fun data(result: ResultActions): JsonNode =
        objectMapper.readTree(result.andExpect(status().isOk).andReturn().response.contentAsString).get("data")
}
