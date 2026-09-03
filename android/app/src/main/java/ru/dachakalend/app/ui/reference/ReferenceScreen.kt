package ru.dachakalend.app.ui.reference

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.ui.crops.cropListBody
import ru.dachakalend.app.ui.guide.guideListBody
import ru.dachakalend.app.ui.theme.NunitoFamily

private val TABS = listOf(
    ReferenceTab.ALL to "Все",
    ReferenceTab.CROPS to "Культуры",
    ReferenceTab.GUIDE to "Болезни",
    ReferenceTab.ARTICLES to "Статьи",
)

/**
 * «Справочник» — общее для всех: культуры, болезни/вредители, статьи блога в одном месте
 * (см. spec §3/§5). Переиспользует cropListBody/guideListBody/articleListBody — те же
 * списковые компоненты, что у CropsScreen/GuideScreen.
 */
@Composable
fun ReferenceScreen(
    onCropClick: (Crop) -> Unit,
    onGuideEntryClick: (String) -> Unit,
    viewModel: ReferenceViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Text(
            "Справочник",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 28.sp,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)
        )

        OutlinedTextField(
            value = state.query,
            onValueChange = { viewModel.setQuery(it) },
            placeholder = { Text("Поиск: культура, болезнь, статья…", fontFamily = NunitoFamily) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (state.query.isNotEmpty()) {
                    IconButton(onClick = { viewModel.setQuery("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Очистить")
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            textStyle = LocalTextStyle.current.copy(fontFamily = NunitoFamily)
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(TABS) { (tab, label) ->
                FilterChip(
                    selected = state.tab == tab,
                    onClick = { viewModel.setTab(tab) },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }
        }

        if (state.tab == ReferenceTab.GUIDE) {
            Text(
                "Определить болезнь или вредителя по фото можно в карточке своей посадки — " +
                    "на вкладке «Болезни» или «Вредители».",
                fontFamily = NunitoFamily,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
        }

        when {
            state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            state.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Ошибка загрузки", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onBackground)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { viewModel.load() }, shape = RoundedCornerShape(16.dp)) {
                        Text("Повторить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                    }
                }
            }
            state.nothingFound -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.SearchOff, contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("Ничего не найдено по «${state.query.trim()}»", fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> {
                val q = state.query.isNotBlank()
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (state.showGuide && state.matchedGuide.isNotEmpty()) {
                        if (q) item(key = "h_guide") { GroupHeader("Болезни и вредители") }
                        guideListBody(state.matchedGuide, onGuideEntryClick)
                    }
                    if (state.showCrops && state.matchedCrops.isNotEmpty()) {
                        if (q) item(key = "h_crops") { GroupHeader("Культуры") }
                        cropListBody(state.matchedCrops, onCropClick)
                    }
                    if (state.showArticles && state.matchedArticles.isNotEmpty()) {
                        if (q) item(key = "h_articles") { GroupHeader("Статьи") }
                        articleListBody(
                            articles = state.matchedArticles,
                            hasMore = !q && state.articles.size < state.articlesTotal,
                            onLoadMore = viewModel::loadMoreArticles,
                            loadingMore = state.loadingMore
                        )
                    }
                    // Браузинг (без поиска), фида нет/пуст — заглушка вместо пустоты (см. spec §8).
                    if (state.showArticles && state.matchedArticles.isEmpty() && !q) {
                        item(key = "articles_empty") {
                            Text(
                                "Статей пока нет.",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupHeader(title: String) {
    Text(
        title,
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Black,
        fontSize = 18.sp,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
    )
}
