package ru.dachakalend.app.ui.today;

@kotlin.Metadata(mv = {2, 2, 0}, k = 2, xi = 48, d1 = {"\u00008\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\u001a\u0012\u0010\u0000\u001a\u00020\u00012\b\b\u0002\u0010\u0002\u001a\u00020\u0003H\u0007\u001a.\u0010\u0004\u001a\u00020\u00012\b\u0010\u0005\u001a\u0004\u0018\u00010\u00062\f\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\t0\b2\f\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u00010\u000bH\u0003\u001a\u0012\u0010\f\u001a\u00020\u00012\b\u0010\u0005\u001a\u0004\u0018\u00010\u0006H\u0003\u001a\u0010\u0010\r\u001a\u00020\u00012\u0006\u0010\u000e\u001a\u00020\tH\u0003\u001a\b\u0010\u000f\u001a\u00020\u0001H\u0003\u001a\b\u0010\u0010\u001a\u00020\u0001H\u0003\u001a\b\u0010\u0011\u001a\u00020\u0001H\u0003\u001a\u001e\u0010\u0012\u001a\u00020\u00012\u0006\u0010\u0013\u001a\u00020\u00142\f\u0010\u0015\u001a\b\u0012\u0004\u0012\u00020\u00010\u000bH\u0003\u001a\u0010\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u0014H\u0002\u00a8\u0006\u0019"}, d2 = {"TodayScreen", "", "viewModel", "Lru/dachakalend/app/ui/today/TodayViewModel;", "TodayContent", "weather", "Lru/dachakalend/app/data/model/WeatherSummary;", "tasks", "", "Lru/dachakalend/app/data/model/TodayTask;", "onRefresh", "Lkotlin/Function0;", "WeatherCard", "TaskCard", "task", "QuickActionsRow", "EmptyTasksCard", "LoadingScreen", "ErrorScreen", "message", "", "onRetry", "taskIcon", "Landroidx/compose/ui/graphics/vector/ImageVector;", "type", "app_debug"})
public final class TodayScreenKt {
    
    @androidx.compose.runtime.Composable()
    public static final void TodayScreen(@org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.ui.today.TodayViewModel viewModel) {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void TodayContent(ru.dachakalend.app.data.model.WeatherSummary weather, java.util.List<ru.dachakalend.app.data.model.TodayTask> tasks, kotlin.jvm.functions.Function0<kotlin.Unit> onRefresh) {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void WeatherCard(ru.dachakalend.app.data.model.WeatherSummary weather) {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void TaskCard(ru.dachakalend.app.data.model.TodayTask task) {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void QuickActionsRow() {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void EmptyTasksCard() {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void LoadingScreen() {
    }
    
    @androidx.compose.runtime.Composable()
    private static final void ErrorScreen(java.lang.String message, kotlin.jvm.functions.Function0<kotlin.Unit> onRetry) {
    }
    
    private static final androidx.compose.ui.graphics.vector.ImageVector taskIcon(java.lang.String type) {
        return null;
    }
}