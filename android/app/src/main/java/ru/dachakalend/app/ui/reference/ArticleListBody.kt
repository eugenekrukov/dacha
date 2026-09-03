package ru.dachakalend.app.ui.reference

import android.net.Uri
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.dachakalend.app.data.model.BlogPost
import ru.dachakalend.app.ui.common.formatIsoDate
import ru.dachakalend.app.ui.theme.NunitoFamily

// Список статей блога — карточка открывает статью на сайте (Custom Tab), нативного рендера
// тела нет (см. spec §5 Android). LazyListScope-расширение, как cropListBody/guideListBody.
fun LazyListScope.articleListBody(
    articles: List<BlogPost>,
    hasMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    loadingMore: Boolean = false,
) {
    items(articles, key = { it.slug }) { article -> ArticleCard(article) }
    if (hasMore) {
        item(key = "articles_load_more") {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                if (loadingMore) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.primary)
                } else {
                    TextButton(onClick = onLoadMore) {
                        Text("Показать ещё", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable
fun ArticleCard(article: BlogPost) {
    val context = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                runCatching {
                    CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(article.url))
                }.onFailure {
                    Toast.makeText(context, "Не удалось открыть браузер", Toast.LENGTH_SHORT).show()
                }
            },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (article.image != null) {
                AsyncImage(
                    model = article.image,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(72.dp).clip(RoundedCornerShape(12.dp))
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🌱", fontSize = 28.sp)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    article.title,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    formatIsoDate(article.publishedAt),
                    fontFamily = NunitoFamily,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                article.lead?.let {
                    Text(
                        it,
                        fontFamily = NunitoFamily,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
