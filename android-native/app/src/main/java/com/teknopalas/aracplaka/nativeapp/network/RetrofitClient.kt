package com.teknopalas.aracplaka.nativeapp.network

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class SessionCookieJar(private val context: Context) : CookieJar {
    private val preferences = context.getSharedPreferences("CookiePrefs", Context.MODE_PRIVATE)

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val editor = preferences.edit()
        for (cookie in cookies) {
            editor.putString(cookie.name, cookie.value)
        }
        editor.apply()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookies = mutableListOf<Cookie>()
        val sessionCookie = preferences.getString("session", null)
        if (sessionCookie != null) {
            cookies.add(
                Cookie.Builder()
                    .domain(url.host)
                    .name("session")
                    .value(sessionCookie)
                    .build()
            )
        }
        return cookies
    }
    
    fun clearSession() {
        preferences.edit().clear().apply()
    }
}

object RetrofitClient {
    private const val BASE_URL = "https://arac-plaka-okuma-sistemi.onrender.com/"
    private var retrofit: Retrofit? = null

    fun getClient(context: Context): Retrofit {
        if (retrofit == null) {
            val cookieJar = SessionCookieJar(context)
            val client = OkHttpClient.Builder()
                .cookieJar(cookieJar)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!
    }
    
    fun clearSession(context: Context) {
        SessionCookieJar(context).clearSession()
    }
}
