package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.auth.*
import com.sparkytc.sparkytcservice.models.ProjectMember
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.models.UserSession
import com.sparkytc.sparkytcservice.repositories.ProjectMemberRepository
import com.sparkytc.sparkytcservice.repositories.UserRepository
import com.sparkytc.sparkytcservice.repositories.UserSessionRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
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
    private val projectRepository: WorkspaceProjectRepository,
    private val projectMemberRepository: ProjectMemberRepository,
    private val projectAccessService: ProjectAccessService,
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

    /** The user's profile and preferences, reloaded so lazy relations can be read. */
    @Transactional
    fun describe(user: User): UserDTO {
        val reloaded = userRepository.findById(user.id).orElseThrow()
        // a default project the user lost access to is ignored
        val defaultProject = reloaded.defaultProject?.takeIf { projectAccessService.canAccess(reloaded, it) }
        return reloaded.toDTO().copy(defaultProjectShortCode = defaultProject?.projectShortCode)
    }

    @Transactional
    fun updateTheme(user: User, request: UpdateThemeDTO) {
        val reloaded = userRepository.findById(user.id).orElseThrow()
        reloaded.theme = request.theme
        userRepository.save(reloaded)
    }

    @Transactional
    fun updateNotificationPreferences(user: User, request: UpdateNotificationPreferencesDTO) {
        val reloaded = userRepository.findById(user.id).orElseThrow()
        reloaded.notifyTestRunAssigned = request.testRunAssigned
        reloaded.notifyTestRunCompleted = request.testRunCompleted
        userRepository.save(reloaded)
    }

    @Transactional
    fun updateDefaultProject(user: User, request: UpdateDefaultProjectDTO) {
        val reloaded = userRepository.findById(user.id).orElseThrow()
        val shortCode = request.projectShortCode
        if (shortCode == null) {
            reloaded.defaultProject = null
        } else {
            val project = projectRepository.findByProjectShortCode(shortCode)
            require(project != null && projectAccessService.canAccess(reloaded, project)) { "No project found" }
            reloaded.defaultProject = project
        }
        userRepository.save(reloaded)
    }

    @Transactional
    fun retrieveUsers(): List<UserDTO> {
        return userRepository.findAllByOrderByUsernameAsc().map { user ->
            val projectIDs = if (user.role == UserRole.TESTER) {
                projectMemberRepository.findAllByUser(user).map { it.project.externalID }
            } else {
                null
            }
            user.toDTO(projectIDs)
        }
    }

    @Transactional
    fun updateUserProjects(userID: UUID, request: UpdateUserProjectsDTO): UserDTO {
        val user = userRepository.findByExternalID(userID)
        requireNotNull(user) { "No user found with id $userID" }

        val projects = request.projectIDs.distinct().map { projectID ->
            requireNotNull(projectRepository.findByExternalID(projectID)) { "No project found with id $projectID" }
        }

        projectMemberRepository.deleteAllByUser(user)
        projectMemberRepository.flush()
        projects.forEach { projectMemberRepository.save(ProjectMember(project = it, user = user)) }

        return user.toDTO(projects.map { it.externalID })
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
        require(!user.isSuperAdmin || user.id == actor.id) { "Only the super admin can change the super admin account" }
        require(request.password.isNullOrEmpty() || actor.isSuperAdmin) { "Only the super admin can reset passwords" }
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

    /**
     * Makes the ADMIN_USERNAME account the super admin, creating it when it doesn't exist yet. The password is
     * only used to create the account, or to reset it when resetPassword is set.
     */
    @Transactional
    fun bootstrapSuperAdmin(username: String, password: String, resetPassword: Boolean): SuperAdminBootstrapResult {
        var user = userRepository.findByUsernameIgnoreCase(username.trim())
        val result = when {
            user == null -> {
                require(password.isNotBlank()) { "ADMIN_PASSWORD is required to create the super admin account" }
                createUser(CreateUserDTO(username = username, displayName = username.trim(), role = UserRole.ADMIN, password = password))
                user = userRepository.findByUsernameIgnoreCase(username.trim())!!
                SuperAdminBootstrapResult.CREATED
            }
            resetPassword && password.isNotBlank() -> {
                validatePassword(password)
                user.passwordHash = passwordEncoder.encode(password)
                userSessionRepository.deleteAllByUser(user)
                SuperAdminBootstrapResult.PASSWORD_RESET
            }
            else -> SuperAdminBootstrapResult.UNCHANGED
        }

        // there is only one super admin, it moves when ADMIN_USERNAME changes
        userRepository.findByIsSuperAdminTrue()?.takeIf { it.id != user.id }?.let {
            it.isSuperAdmin = false
            userRepository.saveAndFlush(it)
        }
        user.isSuperAdmin = true
        user.role = UserRole.ADMIN
        user.isActive = true
        userRepository.save(user)
        return result
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

enum class SuperAdminBootstrapResult {
    CREATED,
    PASSWORD_RESET,
    UNCHANGED
}
