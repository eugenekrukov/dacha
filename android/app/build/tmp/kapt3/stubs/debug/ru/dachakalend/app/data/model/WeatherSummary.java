package ru.dachakalend.app.data.model;

@com.squareup.moshi.JsonClass(generateAdapter = true)
@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0006\n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u001a\b\u0087\b\u0018\u00002\u00020\u0001B?\u0012\n\b\u0001\u0010\u0002\u001a\u0004\u0018\u00010\u0003\u0012\n\b\u0001\u0010\u0004\u001a\u0004\u0018\u00010\u0003\u0012\b\u0010\u0005\u001a\u0004\u0018\u00010\u0006\u0012\b\u0010\u0007\u001a\u0004\u0018\u00010\b\u0012\n\b\u0001\u0010\t\u001a\u0004\u0018\u00010\n\u00a2\u0006\u0004\b\u000b\u0010\fJ\u0010\u0010\u0019\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003\u00a2\u0006\u0002\u0010\u000eJ\u0010\u0010\u001a\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003\u00a2\u0006\u0002\u0010\u000eJ\u0010\u0010\u001b\u001a\u0004\u0018\u00010\u0006H\u00c6\u0003\u00a2\u0006\u0002\u0010\u0012J\u000b\u0010\u001c\u001a\u0004\u0018\u00010\bH\u00c6\u0003J\u0010\u0010\u001d\u001a\u0004\u0018\u00010\nH\u00c6\u0003\u00a2\u0006\u0002\u0010\u0017JJ\u0010\u001e\u001a\u00020\u00002\n\b\u0003\u0010\u0002\u001a\u0004\u0018\u00010\u00032\n\b\u0003\u0010\u0004\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0005\u001a\u0004\u0018\u00010\u00062\n\b\u0002\u0010\u0007\u001a\u0004\u0018\u00010\b2\n\b\u0003\u0010\t\u001a\u0004\u0018\u00010\nH\u00c6\u0001\u00a2\u0006\u0002\u0010\u001fJ\u0013\u0010 \u001a\u00020\n2\b\u0010!\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010\"\u001a\u00020\u0006H\u00d6\u0001J\t\u0010#\u001a\u00020\bH\u00d6\u0001R\u0015\u0010\u0002\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\n\n\u0002\u0010\u000f\u001a\u0004\b\r\u0010\u000eR\u0015\u0010\u0004\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\n\n\u0002\u0010\u000f\u001a\u0004\b\u0010\u0010\u000eR\u0015\u0010\u0005\u001a\u0004\u0018\u00010\u0006\u00a2\u0006\n\n\u0002\u0010\u0013\u001a\u0004\b\u0011\u0010\u0012R\u0013\u0010\u0007\u001a\u0004\u0018\u00010\b\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0014\u0010\u0015R\u0015\u0010\t\u001a\u0004\u0018\u00010\n\u00a2\u0006\n\n\u0002\u0010\u0018\u001a\u0004\b\u0016\u0010\u0017\u00a8\u0006$"}, d2 = {"Lru/dachakalend/app/data/model/WeatherSummary;", "", "tempMin", "", "tempMax", "humidity", "", "condition", "", "frostRisk", "", "<init>", "(Ljava/lang/Double;Ljava/lang/Double;Ljava/lang/Integer;Ljava/lang/String;Ljava/lang/Boolean;)V", "getTempMin", "()Ljava/lang/Double;", "Ljava/lang/Double;", "getTempMax", "getHumidity", "()Ljava/lang/Integer;", "Ljava/lang/Integer;", "getCondition", "()Ljava/lang/String;", "getFrostRisk", "()Ljava/lang/Boolean;", "Ljava/lang/Boolean;", "component1", "component2", "component3", "component4", "component5", "copy", "(Ljava/lang/Double;Ljava/lang/Double;Ljava/lang/Integer;Ljava/lang/String;Ljava/lang/Boolean;)Lru/dachakalend/app/data/model/WeatherSummary;", "equals", "other", "hashCode", "toString", "app_debug"})
public final class WeatherSummary {
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Double tempMin = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Double tempMax = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Integer humidity = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String condition = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Boolean frostRisk = null;
    
    public WeatherSummary(@com.squareup.moshi.Json(name = "temp_min")
    @org.jetbrains.annotations.Nullable()
    java.lang.Double tempMin, @com.squareup.moshi.Json(name = "temp_max")
    @org.jetbrains.annotations.Nullable()
    java.lang.Double tempMax, @org.jetbrains.annotations.Nullable()
    java.lang.Integer humidity, @org.jetbrains.annotations.Nullable()
    java.lang.String condition, @com.squareup.moshi.Json(name = "frost_risk")
    @org.jetbrains.annotations.Nullable()
    java.lang.Boolean frostRisk) {
        super();
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Double getTempMin() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Double getTempMax() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Integer getHumidity() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getCondition() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Boolean getFrostRisk() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Double component1() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Double component2() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Integer component3() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component4() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Boolean component5() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final ru.dachakalend.app.data.model.WeatherSummary copy(@com.squareup.moshi.Json(name = "temp_min")
    @org.jetbrains.annotations.Nullable()
    java.lang.Double tempMin, @com.squareup.moshi.Json(name = "temp_max")
    @org.jetbrains.annotations.Nullable()
    java.lang.Double tempMax, @org.jetbrains.annotations.Nullable()
    java.lang.Integer humidity, @org.jetbrains.annotations.Nullable()
    java.lang.String condition, @com.squareup.moshi.Json(name = "frost_risk")
    @org.jetbrains.annotations.Nullable()
    java.lang.Boolean frostRisk) {
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