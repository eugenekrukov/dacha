package ru.dachakalend.app.data.local

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * GPS без Google Play Services — использует стандартный LocationManager.
 * Сначала пробует getLastKnownLocation (быстро), потом requestSingleUpdate (точнее).
 */
object LocationHelper {

    @SuppressLint("MissingPermission")
    suspend fun getLocation(context: Context): Pair<Double, Double>? {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        // 1. Попробовать последнюю известную координату (< 10 минут)
        val freshEnough = 10 * 60 * 1000L
        val last = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        ).mapNotNull { provider ->
            runCatching { lm.getLastKnownLocation(provider) }.getOrNull()
        }.maxByOrNull { it.time }

        if (last != null && System.currentTimeMillis() - last.time < freshEnough) {
            return Pair(last.latitude, last.longitude)
        }

        // 2. Запросить свежую координату (таймаут 15 сек)
        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER)     -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> return last?.let { Pair(it.latitude, it.longitude) }
        }

        return withTimeoutOrNull(15_000L) {
            suspendCancellableCoroutine { cont ->
                val listener = object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        lm.removeUpdates(this)
                        if (cont.isActive) cont.resume(Pair(loc.latitude, loc.longitude))
                    }
                    @Deprecated("Deprecated in API 29")
                    override fun onStatusChanged(p: String, s: Int, e: Bundle) {}
                    override fun onProviderDisabled(p: String) {
                        lm.removeUpdates(this)
                        if (cont.isActive) cont.resume(null)
                    }
                }
                try {
                    @Suppress("DEPRECATION")
                    lm.requestSingleUpdate(provider, listener, Looper.getMainLooper())
                    cont.invokeOnCancellation { lm.removeUpdates(listener) }
                } catch (_: Exception) {
                    cont.resume(null)
                }
            }
        } ?: last?.let { Pair(it.latitude, it.longitude) }
    }
}
