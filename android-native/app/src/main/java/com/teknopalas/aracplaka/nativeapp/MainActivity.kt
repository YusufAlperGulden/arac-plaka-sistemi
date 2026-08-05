package com.teknopalas.aracplaka.nativeapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.EditText
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.teknopalas.aracplaka.nativeapp.databinding.ActivityMainBinding
import com.teknopalas.aracplaka.nativeapp.network.ApiInterface
import com.teknopalas.aracplaka.nativeapp.network.RecordRequest
import com.teknopalas.aracplaka.nativeapp.network.RecordResponse
import com.teknopalas.aracplaka.nativeapp.network.RetrofitClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@androidx.camera.core.ExperimentalGetImage
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraExecutor: ExecutorService
    private var scannedPlate: String? = null
    private var isScanning = true

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            startCamera()
        } else {
            Toast.makeText(this, "Kamera izni gerekli!", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cameraExecutor = Executors.newSingleThreadExecutor()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        binding.btnScan.setOnClickListener {
            if (scannedPlate != null) {
                showRecordDialog(scannedPlate!!)
            } else {
                Toast.makeText(this, "Henüz plaka okunmadı", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.viewFinder.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
            } catch(exc: Exception) {
                // Ignore
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun processImageProxy(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage != null && isScanning) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    // Basic plate regex (e.g. 34 ABC 123)
                    val plateRegex = Regex("([0-9]{2})\\s*([A-Z]{1,3})\\s*([0-9]{2,4})")
                    for (block in visionText.textBlocks) {
                        val text = block.text.replace("\n", " ").uppercase()
                        val match = plateRegex.find(text)
                        if (match != null) {
                            val plate = match.value.replace(" ", "")
                            runOnUiThread {
                                binding.tvPlateResult.text = "Plaka Bulundu: $plate"
                                scannedPlate = plate
                            }
                            break
                        }
                    }
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }

    private fun showRecordDialog(plate: String) {
        isScanning = false
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_record, null)
        val etMileage = dialogView.findViewById<EditText>(R.id.etMileage)
        val rgAction = dialogView.findViewById<RadioGroup>(R.id.rgAction)

        AlertDialog.Builder(this)
            .setTitle("Kayıt: $plate")
            .setView(dialogView)
            .setPositiveButton("Gönder") { _, _ ->
                val mileageStr = etMileage.text.toString()
                val mileage = if (mileageStr.isNotEmpty()) mileageStr.toInt() else 0
                val action = if (rgAction.checkedRadioButtonId == R.id.rbPickup) "pickup" else "dropoff"
                
                sendRecordToApi(plate, action, mileage)
                
                isScanning = true
                scannedPlate = null
                binding.tvPlateResult.text = "Plaka Bekleniyor..."
            }
            .setNegativeButton("İptal") { dialog, _ ->
                dialog.dismiss()
                isScanning = true
                scannedPlate = null
                binding.tvPlateResult.text = "Plaka Bekleniyor..."
            }
            .setCancelable(false)
            .show()
    }

    private fun sendRecordToApi(plate: String, action: String, mileage: Int) {
        // We get full_name from shared prefs or just pass username.
        val prefs = getSharedPreferences("CookiePrefs", Context.MODE_PRIVATE)
        val userStr = prefs.getString("session", "NativeUser") ?: "NativeUser"

        val request = RecordRequest(
            plate = plate,
            action = action,
            action_type = "Araç Kullanımda",
            mileage = mileage,
            user = userStr // The backend actually relies on session cookie for identity, but requires user field too
        )

        val api = RetrofitClient.getClient(this).create(ApiInterface::class.java)
        api.recordPlate(request).enqueue(object: Callback<RecordResponse> {
            override fun onResponse(call: Call<RecordResponse>, response: Response<RecordResponse>) {
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@MainActivity, "Kayıt Başarılı!", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this@MainActivity, "Hata: ${response.body()?.message}", Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<RecordResponse>, t: Throwable) {
                Toast.makeText(this@MainActivity, "Bağlantı Hatası: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
