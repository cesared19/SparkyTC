package com.sparkytc.sparkytcservice.models

import jakarta.persistence.*
import java.io.Serializable

/** Where a project sits in the list one user chose for themselves; projects they never placed go after these. */
@Entity(name = "user_project_order")
@IdClass(UserProjectOrderKey::class)
class UserProjectOrder(
    @Id
    @Column(name = "user_id")
    val userID: Long = 0,

    @Id
    @Column(name = "project_id")
    val projectID: Long = 0,

    @Column(name = "position")
    var position: Int = 0,
)

data class UserProjectOrderKey(
    val userID: Long = 0,
    val projectID: Long = 0,
) : Serializable
