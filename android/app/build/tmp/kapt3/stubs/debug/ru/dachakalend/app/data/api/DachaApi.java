package ru.dachakalend.app.data.api;

@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\bf\u0018\u00002\u00020\u0001J\u0018\u0010\u0002\u001a\u00020\u00032\b\b\u0001\u0010\u0004\u001a\u00020\u0005H\u00a7@\u00a2\u0006\u0002\u0010\u0006J\u0018\u0010\u0007\u001a\u00020\u00032\b\b\u0001\u0010\u0004\u001a\u00020\u0005H\u00a7@\u00a2\u0006\u0002\u0010\u0006J\u000e\u0010\b\u001a\u00020\tH\u00a7@\u00a2\u0006\u0002\u0010\nJ\u0014\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\r0\fH\u00a7@\u00a2\u0006\u0002\u0010\nJ\u0018\u0010\u000e\u001a\u00020\r2\b\b\u0001\u0010\u0004\u001a\u00020\u000fH\u00a7@\u00a2\u0006\u0002\u0010\u0010J\u0018\u0010\u0011\u001a\u00020\u00122\b\b\u0001\u0010\u0013\u001a\u00020\u0014H\u00a7@\u00a2\u0006\u0002\u0010\u0015\u00a8\u0006\u0016\u00c0\u0006\u0003"}, d2 = {"Lru/dachakalend/app/data/api/DachaApi;", "", "register", "Lru/dachakalend/app/data/model/AuthResponse;", "request", "Lru/dachakalend/app/data/model/LoginRequest;", "(Lru/dachakalend/app/data/model/LoginRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "login", "getMe", "Lru/dachakalend/app/data/model/UserProfile;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getGardens", "", "Lru/dachakalend/app/data/model/Garden;", "createGarden", "Lru/dachakalend/app/data/model/CreateGardenRequest;", "(Lru/dachakalend/app/data/model/CreateGardenRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getToday", "Lru/dachakalend/app/data/model/TodayResponse;", "gardenId", "", "(ILkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface DachaApi {
    
    @retrofit2.http.POST(value = "auth/register")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object register(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.model.LoginRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.model.AuthResponse> $completion);
    
    @retrofit2.http.POST(value = "auth/login")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object login(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.model.LoginRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.model.AuthResponse> $completion);
    
    @retrofit2.http.GET(value = "auth/me")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getMe(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.model.UserProfile> $completion);
    
    @retrofit2.http.GET(value = "gardens")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getGardens(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.util.List<ru.dachakalend.app.data.model.Garden>> $completion);
    
    @retrofit2.http.POST(value = "gardens")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object createGarden(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    ru.dachakalend.app.data.model.CreateGardenRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.model.Garden> $completion);
    
    @retrofit2.http.GET(value = "today")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getToday(@retrofit2.http.Query(value = "garden_id")
    int gardenId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super ru.dachakalend.app.data.model.TodayResponse> $completion);
}