package com.sparkytc.sparkytcservice.models

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/** Grants a tester access to a project. Admins can access every project without a membership. */
@Entity(name = "project_members")
class ProjectMember(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    val project: WorkspaceProject,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User,
)
