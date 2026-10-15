package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.ProjectMemberRepository
import org.springframework.stereotype.Service

/**
 * Decides which projects the current user can see. Admins see every project, testers only the
 * projects an admin assigned to them.
 */
@Service
class ProjectAccessService(
    private val projectMemberRepository: ProjectMemberRepository,
) {
    fun canAccess(user: User?, project: WorkspaceProject): Boolean {
        if (user == null) return false
        if (user.role == UserRole.ADMIN) return true
        return projectMemberRepository.existsByProjectAndUser(project, user)
    }

    /**
     * Throws the same error as a missing project, so testers can't tell which projects exist
     * outside of the ones assigned to them.
     */
    fun requireAccess(project: WorkspaceProject) {
        require(canAccess(CurrentUser.get(), project)) { "No project found" }
    }

    fun accessibleProjects(user: User?, projects: List<WorkspaceProject>): List<WorkspaceProject> {
        if (user == null) return emptyList()
        if (user.role == UserRole.ADMIN) return projects
        val projectIDs = projectMemberRepository.findAllByUser(user).map { it.project.id }.toSet()
        return projects.filter { it.id in projectIDs }
    }
}
