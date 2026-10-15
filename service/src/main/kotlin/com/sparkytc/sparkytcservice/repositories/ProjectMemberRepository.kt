package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.ProjectMember
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository

interface ProjectMemberRepository : JpaRepository<ProjectMember, Long> {
    fun existsByProjectAndUser(project: WorkspaceProject, user: User): Boolean

    fun findAllByUser(user: User): List<ProjectMember>

    fun deleteAllByUser(user: User)
}
