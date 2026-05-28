package ru.dachakalend.app.data.model;

@com.squareup.moshi.JsonClass(generateAdapter = true)
@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u00000\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0010\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0087\b\u0018\u00002\u00020\u0001B3\u0012\b\b\u0001\u0010\u0002\u001a\u00020\u0003\u0012\f\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00060\u0005\u0012\b\u0010\u0007\u001a\u0004\u0018\u00010\b\u0012\b\b\u0001\u0010\t\u001a\u00020\n\u00a2\u0006\u0004\b\u000b\u0010\fJ\t\u0010\u0015\u001a\u00020\u0003H\u00c6\u0003J\u000f\u0010\u0016\u001a\b\u0012\u0004\u0012\u00020\u00060\u0005H\u00c6\u0003J\u000b\u0010\u0017\u001a\u0004\u0018\u00010\bH\u00c6\u0003J\t\u0010\u0018\u001a\u00020\nH\u00c6\u0003J9\u0010\u0019\u001a\u00020\u00002\b\b\u0003\u0010\u0002\u001a\u00020\u00032\u000e\b\u0002\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00060\u00052\n\b\u0002\u0010\u0007\u001a\u0004\u0018\u00010\b2\b\b\u0003\u0010\t\u001a\u00020\nH\u00c6\u0001J\u0013\u0010\u001a\u001a\u00020\u001b2\b\u0010\u001c\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010\u001d\u001a\u00020\u0003H\u00d6\u0001J\t\u0010\u001e\u001a\u00020\nH\u00d6\u0001R\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000eR\u0017\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00060\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010R\u0013\u0010\u0007\u001a\u0004\u0018\u00010\b\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012R\u0011\u0010\t\u001a\u00020\n\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0013\u0010\u0014\u00a8\u0006\u001f"}, d2 = {"Lru/dachakalend/app/data/model/TodayResponse;", "", "gardenId", "", "tasks", "", "Lru/dachakalend/app/data/model/TodayTask;", "weather", "Lru/dachakalend/app/data/model/WeatherSummary;", "generatedAt", "", "<init>", "(ILjava/util/List;Lru/dachakalend/app/data/model/WeatherSummary;Ljava/lang/String;)V", "getGardenId", "()I", "getTasks", "()Ljava/util/List;", "getWeather", "()Lru/dachakalend/app/data/model/WeatherSummary;", "getGeneratedAt", "()Ljava/lang/String;", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"})
public final class TodayResponse {
    private final int gardenId = 0;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<ru.dachakalend.app.data.model.TodayTask> tasks = null;
    @org.jetbrains.annotations.Nullable()
    private final ru.dachakalend.app.data.model.WeatherSummary weather = null;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String generatedAt = null;
    
    public TodayResponse(@com.squareup.moshi.Json(name = "garden_id")
    int gardenId, @org.jetbrains.annotations.NotNull()
    java.util.List<ru.dachakalend.app.data.model.TodayTask> tasks, @org.jetbrains.annotations.Nullable()
    ru.dachakalend.app.data.model.WeatherSummary weather, @com.squareup.moshi.Json(name = "generated_at")
    @org.jetbrains.annotations.NotNull()
    java.lang.String generatedAt) {
        super();
    }
    
    public final int getGardenId() {
        return 0;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<ru.dachakalend.app.data.model.TodayTask> getTasks() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final ru.dachakalend.app.data.model.WeatherSummary getWeather() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getGeneratedAt() {
        return null;
    }
    
    public final int component1() {
        return 0;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<ru.dachakalend.app.data.model.TodayTask> component2() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final ru.dachakalend.app.data.model.WeatherSummary component3() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component4() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final ru.dachakalend.app.data.model.TodayResponse copy(@com.squareup.moshi.Json(name = "garden_id")
    int gardenId, @org.jetbrains.annotations.NotNull()
    java.util.List<ru.dachakalend.app.data.model.TodayTask> tasks, @org.jetbrains.annotations.Nullable()
    ru.dachakalend.app.data.model.WeatherSummary weather, @com.squareup.moshi.Json(name = "generated_at")
    @org.jetbrains.annotations.NotNull()
    java.lang.String generatedAt) {
        return null;
    }
    
    @java.lang.Override()
    public boolean equals(@org.jetbrains.annotations.Nullable()
    java.lang.Object other) {
        return false;
    }
    
    @java.lang.Override()
    public int hashCode() {
        return 0;
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public java.lang.String toString() {
        return null;
    }
}