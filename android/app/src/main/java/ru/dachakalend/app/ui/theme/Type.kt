package ru.dachakalend.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.R

/** Nunito — тёплый, округлый. Основной шрифт приложения. */
val NunitoFamily = FontFamily(
    Font(R.font.nunito_regular,   FontWeight.Normal),
    Font(R.font.nunito_semibold,  FontWeight.SemiBold),
    Font(R.font.nunito_bold,      FontWeight.Bold),
    Font(R.font.nunito_extrabold, FontWeight.ExtraBold),
    Font(R.font.nunito_black,     FontWeight.Black),
)

val DachaTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Black,
        fontSize      = 44.sp,
        lineHeight    = 48.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineLarge = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Black,
        fontSize      = 34.sp,
        lineHeight    = 36.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Black,
        fontSize      = 28.sp,
        lineHeight    = 32.sp,
        letterSpacing = (-0.3).sp
    ),
    titleLarge = TextStyle(
        fontFamily    = NunitoFamily,
        fontWeight    = FontWeight.Black,
        fontSize      = 22.sp,
        lineHeight    = 28.sp,
        letterSpacing = (-0.2).sp
    ),
    titleMedium = TextStyle(
        fontFamily    = NunitoFamily,
        fontWeight    = FontWeight.ExtraBold,
        fontSize      = 16.sp,
        lineHeight    = 22.sp,
        letterSpacing = (-0.1).sp
    ),
    titleSmall = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Bold,
        fontSize   = 14.sp,
        lineHeight = 20.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize   = 16.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Bold,
        fontSize   = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Bold,
        fontSize   = 12.sp,
        lineHeight = 16.sp
    ),
    labelLarge = TextStyle(
        fontFamily    = NunitoFamily,
        fontWeight    = FontWeight.ExtraBold,
        fontSize      = 14.sp,
        lineHeight    = 20.sp,
        letterSpacing = 0.1.sp
    ),
    labelMedium = TextStyle(
        fontFamily    = NunitoFamily,
        fontWeight    = FontWeight.Bold,
        fontSize      = 12.sp,
        lineHeight    = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily    = NunitoFamily,
        fontWeight    = FontWeight.Bold,
        fontSize      = 11.sp,
        lineHeight    = 14.sp,
        letterSpacing = 0.5.sp
    ),
)


