package com.sparkytc.sparkytcservice.controllers

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

object TestAuth {
    const val ADMIN_USERNAME = "admin"
    const val ADMIN_PASSWORD = "admin-password"

    fun anonymousMockMvc(context: WebApplicationContext): MockMvc {
        return MockMvcBuilders.webAppContextSetup(context).build()
    }

    fun login(context: WebApplicationContext, objectMapper: ObjectMapper, username: String = ADMIN_USERNAME, password: String = ADMIN_PASSWORD): String {
        val result = anonymousMockMvc(context).perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(mapOf("username" to username, "password" to password))))
            .andExpect(status().isOk)
            .andReturn()
        return objectMapper.readTree(result.response.contentAsString).get("data").get("token").asText()
    }

    /** A MockMvc that sends the session token of the given user with every request. */
    fun authenticatedMockMvc(context: WebApplicationContext, token: String): MockMvc {
        return MockMvcBuilders.webAppContextSetup(context)
            .defaultRequest<DefaultMockMvcBuilder>(get("/").header(HttpHeaders.AUTHORIZATION, "Bearer $token"))
            .build()
    }
}
