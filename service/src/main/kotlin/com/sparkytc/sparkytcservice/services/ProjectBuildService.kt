package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.builds.ProjectBuildDTO
import com.sparkytc.sparkytcservice.dto.builds.SaveProjectBuildDTO
import com.sparkytc.sparkytcservice.models.ProjectBuild
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.ProjectBuildRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/** The builds registered for each project. Everyone with access sees them, only admins change them. */
@Service
class ProjectBuildService(
    private val projectBuildRepository: ProjectBuildRepository,
    private val projectRepository: WorkspaceProjectRepository,
    private val testRunRepository: TestRunRepository,
    private val projectAccessService: ProjectAccessService,
) {
    @Transactional
    fun retrieveBuilds(projectShortCode: String): List<ProjectBuildDTO> {
        return projectBuildRepository.findAllByProjectOrderByIdDesc(project(projectShortCode)).map { it.toDTO() }
    }

    @Transactional
    fun createBuild(projectShortCode: String, request: SaveProjectBuildDTO): ProjectBuildDTO {
        val project = project(projectShortCode)
        val buildNumber = validBuildNumber(project, request.buildNumber, null)
        val build = ProjectBuild(project = project, buildNumber = buildNumber, createdBy = CurrentUser.get())
        projectBuildRepository.save(build)
        return build.toDTO()
    }

    @Transactional
    fun updateBuild(buildID: UUID, request: SaveProjectBuildDTO): ProjectBuildDTO {
        val build = build(buildID)
        build.buildNumber = validBuildNumber(build.project, request.buildNumber, build)
        projectBuildRepository.save(build)
        return build.toDTO()
    }

    @Transactional
    fun deleteBuild(buildID: UUID) {
        val build = build(buildID)
        require(!testRunRepository.existsByBuild(build)) { "Build ${build.buildNumber} is used by test runs and can't be deleted" }
        projectBuildRepository.delete(build)
    }

    fun currentBuild(project: WorkspaceProject): ProjectBuildDTO? {
        return projectBuildRepository.findTopByProjectOrderByIdDesc(project)?.toDTO()
    }

    /** A build of the project, for test runs to reference. */
    fun requireBuild(project: WorkspaceProject, buildID: UUID): ProjectBuild {
        val build = projectBuildRepository.findByExternalID(buildID)
        require(build != null && build.project.id == project.id) { "No build found with id $buildID" }
        return build
    }

    private fun validBuildNumber(project: WorkspaceProject, input: String, current: ProjectBuild?): String {
        val buildNumber = input.trim()
        require(buildNumber.isNotEmpty()) { "Build number is required" }
        require(buildNumber.length <= MAXIMUM_LENGTH) { "Build number must be at most $MAXIMUM_LENGTH characters" }
        val existing = projectBuildRepository.findByProjectAndBuildNumberIgnoreCase(project, buildNumber)
        require(existing == null || existing.id == current?.id) { "Build $buildNumber already exists" }
        return buildNumber
    }

    private fun project(projectShortCode: String): WorkspaceProject {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)
        return project
    }

    private fun build(buildID: UUID): ProjectBuild {
        val build = projectBuildRepository.findByExternalID(buildID)
        requireNotNull(build) { "No build found with id $buildID" }
        projectAccessService.requireAccess(build.project)
        return build
    }

    companion object {
        const val MAXIMUM_LENGTH = 100
    }
}
