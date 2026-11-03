package com.sparkytc.sparkytcservice.auth

/**
 * The project API token used for the current integration request: its project and whether it can write. Set by
 * the IntegrationTokenInterceptor and cleared once the request completes.
 */
object CurrentIntegrationProject {
    data class Token(val tokenID: Long, val projectID: Long, val canWrite: Boolean)

    private val token = ThreadLocal<Token?>()

    fun get(): Long = token().projectID

    fun token(): Token = requireNotNull(token.get()) { "No project token" }

    fun set(value: Token) = token.set(value)

    fun clear() = token.remove()
}
