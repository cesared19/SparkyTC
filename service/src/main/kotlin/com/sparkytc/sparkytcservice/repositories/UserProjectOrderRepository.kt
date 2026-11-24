package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.UserProjectOrder
import com.sparkytc.sparkytcservice.models.UserProjectOrderKey
import org.springframework.data.jpa.repository.JpaRepository

interface UserProjectOrderRepository : JpaRepository<UserProjectOrder, UserProjectOrderKey> {
    fun findAllByUserIDOrderByPositionAsc(userID: Long): List<UserProjectOrder>

    fun deleteAllByUserID(userID: Long)
}
