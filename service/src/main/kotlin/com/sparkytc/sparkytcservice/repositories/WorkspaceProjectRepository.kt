package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.*

interface WorkspaceProjectRepository : JpaRepository<WorkspaceProject, Long> {
    fun findByTitle(title: String): WorkspaceProject?
    fun findByProjectShortCode(projectShortCode: String): WorkspaceProject?
    fun findByExternalID(externalID: UUID): WorkspaceProject?
    fun findAllByOrderByTitleAsc(): List<WorkspaceProject>
}