package com.teknopalas.aracplaka.nativeapp

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.teknopalas.aracplaka.nativeapp.databinding.ActivityLoginBinding
import com.teknopalas.aracplaka.nativeapp.network.ApiInterface
import com.teknopalas.aracplaka.nativeapp.network.LoginRequest
import com.teknopalas.aracplaka.nativeapp.network.LoginResponse
import com.teknopalas.aracplaka.nativeapp.network.RetrofitClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnLogin.setOnClickListener {
            val username = binding.etUsername.text.toString()
            val password = binding.etPassword.text.toString()

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Lütfen tüm alanları doldurun", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            loginUser(username, password)
        }
    }

    private fun loginUser(username: String, password: String) {
        binding.btnLogin.isEnabled = false
        
        val api = RetrofitClient.getClient(this).create(ApiInterface::class.java)
        api.login(LoginRequest(username, password)).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                binding.btnLogin.isEnabled = true
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@LoginActivity, "Giriş Başarılı!", Toast.LENGTH_SHORT).show()
                    val intent = Intent(this@LoginActivity, MainActivity::class.java)
                    startActivity(intent)
                    finish()
                } else {
                    Toast.makeText(this@LoginActivity, response.body()?.message ?: "Giriş Hatası", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                binding.btnLogin.isEnabled = true
                Toast.makeText(this@LoginActivity, "Bağlantı Hatası: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }
}
