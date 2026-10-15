package com.cherry.cherryservice.models

import com.cherry.cherryservice.dto.jira.JiraLinkDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "test_case_jira_links")
class TestCaseJiraLink(
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id")
    val testCase: TestCase,

    @Column(name = "issue_key", nullable = false)
    val issueKey: String,

    @Column(name = "issue_url", nullable = false)
    val issueURL: String,
) {
    fun toDTO(): JiraLinkDTO {
        return JiraLinkDTO(externalID, creationDate, issueKey, issueURL)
    }
}
