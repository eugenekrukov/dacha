package ru.dachakalend.app.data.repository;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000$\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0007\u0018\u00002\u00020\u0001B\u0019\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0004\b\u0006\u0010\u0007J\u0014\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tH\u0086@\u00a2\u0006\u0002\u0010\u000bR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\f"}, d2 = {"Lru/dachakalend/app/data/repository/TodayRepository;", "", "api", "Lru/dachakalend/app/data/api/DachaApi;", "tokenStorage", "Lru/dachakalend/app/data/local/TokenStorage;", "<init>", "(Lru/dachakalend/app/data/api/DachaApi;Lru/dachakalend/app/data/local/TokenStorage;)V", "getToday", "Lru/dachakalend/app/data/repository/Result;", "Lru/dachakalend/app/data/model/TodayResponse;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public final class TodayRepository {
    @org.jetbrains.annotations.NotNull()
    private final ru.dachakalend.app.data.api.DachaApi api = null;
    @org.jetbrains.annotations.NotNull()
    private final ru.dachakalend.app.data.local.TokenStorage tokenStorage = null;
    
    @javax.inject.Inject()
    public TodayRepository(@org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.api.DachaApi api, @org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.local.TokenStorage tokenStorage) {
        super();
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object getToday(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.repository.Result<ru.dachakalend.app.data.model.TodayResponse>> $completion) {
        return null;
    }
}