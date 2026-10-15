package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.auth.*
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.models.UserSession
import com.sparkytc.sparkytcservice.repositories.UserRepository
import com.sparkytc.sparkytcservice.repositories.UserSessionRepository
import jakarta.transaction.Transactional
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.*

class AuthenticationException(message: String) : RuntimeException(message)

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val userSessionRepository: UserSessionRepository,
) {
    private val passwordEncoder = BCryptPasswordEncoder()
    private val secureRandom = SecureRandom()

    // compared against when the username doesn't exist, so failed logins take the same time either way
    private val unknownUserHash = passwordEncoder.encode(UUID.randomUUID().toString())

    @Transactional
    fun login(request: LoginDTO): LoginResponseDTO {
        val user = userRepository.findByUsernameIgnoreCase(request.username.trim())
        val passwordMatches = passwordEncoder.matches(request.password, user?.passwordHash ?: unknownUserHash)
        if (user == null || !passwordMatches || !user.isActive) {
            throw AuthenticationException("Invalid username or password")
        }

        userSessionRepository.deleteExpired(Date())

        val tokenBytes = ByteArray(32).also { secureRandom.nextBytes(it) }
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes)
        val expiresAt = Date(System.currentTimeMillis() + SESSION_DURATION_MILLIS)
        userSessionRepository.save(UserSession(tokenHash = hash(token), user = user, expiresAt = expiresAt))

        return LoginResponseDTO(token, expiresAt, user.toDTO())
    }

    @Transactional
    fun logout(token: String) {
        userSessionRepository.deleteByTokenHash(hash(token))
    }

    /** Returns the active user that owns the session token, or null when the token is unknown or expired. */
    @Transactional
    fun authenticate(token: String): User? {
        val session = userSessionRepository.findByTokenHash(hash(token)) ?: return null
        if (session.expiresAt.before(Date()) || !session.user.isActive) {
            userSessionRepository.delete(session)
            return null
        }
        return session.user
    }

    @Transactional
    fun changePassword(user: User, request: ChangePasswordDTO) {
        if (!passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            throw IllegalArgumentException("Current password is incorrect")
        }
        validatePassword(request.newPassword)

        user.passwordHash = passwordEncoder.encode(request.newPassword)
        userRepository.save(user)
    }

    fun retrieveUsers(): List<UserDTO> {
        return userRepository.findAllByOrderByUsernameAsc().map { it.toDTO() }
    }

    @Transactional
    fun createUser(request: CreateUserDTO): UserDTO {
        val username = request.username.trim()
        require(username.matches(USERNAME_PATTERN)) { "Username must be 3-50 characters: letters, numbers, dots, dashes or underscores" }
        require(userRepository.findByUsernameIgnoreCase(username) == null) { "Username $username is already taken" }
        require(request.displayName.isNotBlank()) { "Display name is required" }
        validatePassword(request.password)

        val user = User(
            username = username,
            displayName = request.displayName.trim(),
            passwordHash = passwordEncoder.encode(request.password),
            role = request.role,
        )
        userRepository.save(user)
        return user.toDTO()
    }

    @Transactional
    fun updateUser(actor: User, userID: UUID, request: UpdateUserDTO): UserDTO {
        val user = userRepository.findByExternalID(userID)
        requireNotNull(user) { "No user found with id $userID" }
        require(request.displayName.isNotBlank()) { "Display name is required" }

        val losesAdmin = user.role == UserRole.ADMIN && user.isActive && (request.role != UserRole.ADMIN || !request.isActive)
        if (losesAdmin) {
            require(user.id != actor.id) { "You can't remove your own admin access or deactivate yourself" }
            require(userRepository.countByRoleAndIsActiveTrue(UserRole.ADMIN) > 1) { "There must be at least one active admin" }
        }

        user.displayName = request.displayName.trim()
        user.role = request.role
        user.isActive = request.isActive
        if (!request.password.isNullOrEmpty()) {
            validatePassword(request.password)
            user.passwordHash = passwordEncoder.encode(request.password)
        }
        userRepository.save(user)

        // sign the user out everywhere when they are deactivated or their password is reset
        if (!user.isActive || !request.password.isNullOrEmpty()) {
            userSessionRepository.deleteAllByUser(user)
        }

        return user.toDTO()
    }

    /** Creates the first admin account when there are no users yet. Returns true when an account was created. */
    @Transactional
    fun bootstrapAdmin(username: String, password: String): Boolean {
        if (userRepository.count() > 0) return false

        createUser(CreateUserDTO(username = username, displayName = username, role = UserRole.ADMIN, password = password))
        return true
    }

    fun hasUsers(): Boolean = userRepository.count() > 0

    private fun validatePassword(password: String) {
        require(password.length >= MINIMUM_PASSWORD_LENGTH) { "Password must be at least $MINIMUM_PASSWORD_LENGTH characters" }
    }

    private fun hash(token: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(token.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val MINIMUM_PASSWORD_LENGTH = 8
        const val SESSION_DURATION_MILLIS = 7L * 24 * 60 * 60 * 1000
        private val USERNAME_PATTERN = Regex("^[A-Za-z0-9._-]{3,50}$")
    }
}
