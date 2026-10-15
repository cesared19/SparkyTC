package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.projects.JiraFailureMode
import com.sparkytc.sparkytcservice.dto.projects.WorkspaceProjectDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "workspace_projects")
class WorkspaceProject(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @Column(name = "modify_date")
    @UpdateTimestamp
    val modifyDate: Date = Date(),

    @Column(name = "title")
    var title: String,

    @Column(name = "project_short_code")
    var projectShortCode: String,

    @Column(name = "description")
    var description: String?,

    @Column(name = "jira_failure_mode", nullable = false)
    @Enumerated(EnumType.STRING)
    var jiraFailureMode: JiraFailureMode = JiraFailureMode.MANUAL,

    // Jira project issues are created in, null uses the default JIRA_PROJECT_KEY
    @Column(name = "jira_project_key")
    var jiraProjectKey: String? = null,
) {

    fun toDTO(): WorkspaceProjectDTO {
        return WorkspaceProjectDTO(externalID, creationDate, title, projectShortCode, description, jiraFailureMode, jiraProjectKey)
    }
}