package com.sparkytc.sparkytcservice.auth

import com.sparkytc.sparkytcservice.models.User

/**
 * Holds the user authenticated for the current request. Set by the AuthenticationInterceptor
 * and cleared once the request completes.
 */
object CurrentUser {
    private val user = ThreadLocal<User?>()

    fun get(): User? = user.get()

    fun set(value: User?) = user.set(value)

    fun clear() = user.remove()
}
