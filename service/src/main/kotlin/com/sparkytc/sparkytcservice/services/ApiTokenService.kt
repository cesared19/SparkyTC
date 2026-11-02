package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.integration.CreateProjectApiTokenDTO
import com.sparkytc.sparkytcservice.dto.integration.CreatedProjectApiTokenDTO
import com.sparkytc.sparkytcservice.dto.integration.ProjectApiTokenDTO
import com.sparkytc.sparkytcservice.models.ProjectApiToken
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.ProjectApiTokenRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.Date
import java.util.UUID

/** Project API tokens: admins create and revoke them; the integration API authenticates with them. */
@Service
class ApiTokenService(
    private val tokenRepository: ProjectApiTokenRepository,
    private val projectRepository: WorkspaceProjectRepository,
) {
    private val random = SecureRandom()

    @Transactional
    fun retrieveTokens(projectShortCode: String): List<ProjectApiTokenDTO> {
        return tokenRepository.findAllByProjectOrderByCreationDateDesc(project(projectShortCode)).map { it.toDTO() }
    }

    @Transactional
    fun createToken(projectShortCode: String, request: CreateProjectApiTokenDTO): CreatedProjectApiTokenDTO {
        val project = project(projectShortCode)
        val name = request.name?.trim().orEmpty()
        require(name.isNotEmpty()) { "Give the token a name, such as the app that uses it" }
        require(name.length <= 100) { "The name can have up to 100 characters" }
        val bytes = ByteArray(32).also { random.nextBytes(it) }
        val secret = PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        val token = ProjectApiToken(
            project = project,
            name = name,
            tokenHash = hash(secret),
            tokenPrefix = secret.take(PREFIX.length + 6),
            createdBy = CurrentUser.get(),
        )
        tokenRepository.save(token)
        return CreatedProjectApiTokenDTO(token.toDTO(), secret)
    }

    @Transactional
    fun revokeToken(tokenID: UUID) {
        val token = tokenRepository.findByExternalID(tokenID)
        requireNotNull(token) { "No token found" }
        tokenRepository.delete(token)
    }

    /** The project a token gives access to, or null for an unknown token. Notes when it was last used. */
    @Transactional
    fun authenticate(secret: String): WorkspaceProject? {
        if (!secret.startsWith(PREFIX)) return null
        val token = tokenRepository.findByTokenHash(hash(secret)) ?: return null
        val now = Date()
        // once a minute is enough to tell whether a token is in use
        if (token.lastUsedAt == null || now.time - token.lastUsedAt!!.time > 60_000) {
            token.lastUsedAt = now
            tokenRepository.save(token)
        }
        return token.project.also { it.projectShortCode }
    }

    private fun project(projectShortCode: String): WorkspaceProject {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        return project
    }

    companion object {
        const val PREFIX = "stc_"

        fun hash(secret: String): String {
            val digest = MessageDigest.getInstance("SHA-256").digest(secret.toByteArray())
            return digest.joinToString("") { "%02x".format(it) }
        }
    }
}
