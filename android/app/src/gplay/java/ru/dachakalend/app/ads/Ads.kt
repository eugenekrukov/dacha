package ru.dachakalend.app.ads

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.yandex.mobile.ads.banner.BannerAdEventListener
import com.yandex.mobile.ads.banner.BannerAdSize
import com.yandex.mobile.ads.banner.BannerAdView
import com.yandex.mobile.ads.common.AdError
import com.yandex.mobile.ads.common.AdRequest
import com.yandex.mobile.ads.common.AdRequestConfiguration
import com.yandex.mobile.ads.common.AdRequestError
import com.yandex.mobile.ads.common.ImpressionData
import com.yandex.mobile.ads.common.MobileAds
import com.yandex.mobile.ads.interstitial.InterstitialAd
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader
import ru.dachakalend.app.BuildConfig

/**
 * Реклама РСЯ (Yandex Mobile Ads) для рекламных сборок (gplay/samsung). Идентична для обоих
 * флейворов (если правишь — синхронизируй копию в src/samsung). Идентификаторы — из BuildConfig.
 */
object Ads {
    private const val TAG = "Ads"

    // Интерстишл показываем не на каждое событие, а раз в N (частотный кэп — не раздражать).
    private const val INTERSTITIAL_EVERY = 10

    private var eventCounter = 0
    private var interstitialLoader: InterstitialAdLoader? = null

    fun init(context: Context) {
        // Согласие на показ персонализированной рекламы. Политика конфиденциальности — на лендинге.
        MobileAds.setUserConsent(true)
        MobileAds.initialize(context.applicationContext) {}
    }

    /** Адаптивный sticky-баннер на всю ширину. Размещается внизу списковых экранов. */
    @Composable
    fun Banner(modifier: Modifier = Modifier) {
        AndroidView(
            modifier = modifier.fillMaxWidth(),
            factory = { ctx ->
                BannerAdView(ctx).apply {
                    val dm = ctx.resources.displayMetrics
                    val widthDp = (dm.widthPixels / dm.density).toInt()
                    setAdSize(BannerAdSize.stickySize(ctx, widthDp))
                    setAdUnitId(BuildConfig.BANNER_AD_UNIT)
                    // Лог результата загрузки — без показа баннер схлопывается в 0 высоту молча.
                    setBannerAdEventListener(object : BannerAdEventListener {
                        override fun onAdLoaded() {
                            Log.i(TAG, "banner onAdLoaded unit=${BuildConfig.BANNER_AD_UNIT}")
                        }
                        override fun onAdFailedToLoad(error: AdRequestError) {
                            Log.w(TAG, "banner onAdFailedToLoad code=${error.code} desc=${error.description} unit=${BuildConfig.BANNER_AD_UNIT}")
                        }
                        override fun onAdClicked() {}
                        override fun onLeftApplication() {}
                        override fun onReturnedToApplication() {}
                        override fun onImpression(impressionData: ImpressionData?) {}
                    })
                    loadAd(AdRequest.Builder().build())
                }
            }
        )
    }

    /** Контентное событие (например, переключение вкладки). Каждое N-е — показ интерстишла. */
    fun onContentEvent(activity: Activity) {
        eventCounter++
        if (eventCounter % INTERSTITIAL_EVERY != 0) return
        loadAndShowInterstitial(activity)
    }

    private fun loadAndShowInterstitial(activity: Activity) {
        val loader = interstitialLoader
            ?: InterstitialAdLoader(activity.applicationContext).also { interstitialLoader = it }
        loader.setAdLoadListener(object : InterstitialAdLoadListener {
            override fun onAdLoaded(interstitialAd: InterstitialAd) {
                interstitialAd.setAdEventListener(object : InterstitialAdEventListener {
                    override fun onAdShown() {}
                    override fun onAdFailedToShow(adError: AdError) {}
                    override fun onAdDismissed() { interstitialAd.setAdEventListener(null) }
                    override fun onAdClicked() {}
                    override fun onAdImpression(impressionData: ImpressionData?) {}
                })
                interstitialAd.show(activity)
            }
            override fun onAdFailedToLoad(error: AdRequestError) {
                Log.w(TAG, "interstitial onAdFailedToLoad code=${error.code} desc=${error.description}")
            }
        })
        loader.loadAd(AdRequestConfiguration.Builder(BuildConfig.INTERSTITIAL_AD_UNIT).build())
    }
}
