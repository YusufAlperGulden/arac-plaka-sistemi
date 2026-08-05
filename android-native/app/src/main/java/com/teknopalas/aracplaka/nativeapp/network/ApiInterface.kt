package com.teknopalas.aracplaka.nativeapp.network

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    val success: Boolean,
    val message: String,
    val is_admin: Boolean?,
    val full_name: String?
)

data class RecordRequest(
    val plate: String,
    val action: String,
    val action_type: String,
    val mileage: Int,
    val user: String,
    val notes: String = "",
    val request_no: String = "",
    val service_form_no: String = ""
)

data class RecordResponse(
    val success: Boolean,
    val message: String
)

interface ApiInterface {
    @POST("api/login")
    fun login(@Body request: LoginRequest): Call<LoginResponse>

    @POST("api/record")
    fun recordPlate(@Body request: RecordRequest): Call<RecordResponse>
}
