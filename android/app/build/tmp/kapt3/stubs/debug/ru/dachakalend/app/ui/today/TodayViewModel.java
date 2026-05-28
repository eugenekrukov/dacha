package ru.dachakalend.app.ui.today;

@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000*\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u0011\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0004\b\u0004\u0010\u0005J\u0006\u0010\r\u001a\u00020\u000eR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u0007X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\t\u001a\b\u0012\u0004\u0012\u00020\b0\n\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\f\u00a8\u0006\u000f"}, d2 = {"Lru/dachakalend/app/ui/today/TodayViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lru/dachakalend/app/data/repository/TodayRepository;", "<init>", "(Lru/dachakalend/app/data/repository/TodayRepository;)V", "_uiState", "Lkotlinx/coroutines/flow/MutableStateFlow;", "Lru/dachakalend/app/ui/today/TodayUiState;", "uiState", "Lkotlinx/coroutines/flow/StateFlow;", "getUiState", "()Lkotlinx/coroutines/flow/StateFlow;", "loadToday", "", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class TodayViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final ru.dachakalend.app.data.repository.TodayRepository repository = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<ru.dachakalend.app.ui.today.TodayUiState> _uiState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<ru.dachakalend.app.ui.today.TodayUiState> uiState = null;
    
    @javax.inject.Inject()
    public TodayViewModel(@org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.repository.TodayRepository repository) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<ru.dachakalend.app.ui.today.TodayUiState> getUiState() {
        return null;
    }
    
    public final void loadToday() {
    }
}