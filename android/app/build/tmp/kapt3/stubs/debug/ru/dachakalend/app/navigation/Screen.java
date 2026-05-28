package ru.dachakalend.app.navigation;

@kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000$\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\b6\u0018\u00002\u00020\u0001:\u0004\b\t\n\u000bB\u0011\b\u0004\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0004\b\u0004\u0010\u0005R\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007\u0082\u0001\u0004\f\r\u000e\u000f\u00a8\u0006\u0010"}, d2 = {"Lru/dachakalend/app/navigation/Screen;", "", "route", "", "<init>", "(Ljava/lang/String;)V", "getRoute", "()Ljava/lang/String;", "Today", "Calendar", "Plantings", "Harvest", "Lru/dachakalend/app/navigation/Screen$Calendar;", "Lru/dachakalend/app/navigation/Screen$Harvest;", "Lru/dachakalend/app/navigation/Screen$Plantings;", "Lru/dachakalend/app/navigation/Screen$Today;", "app_debug"})
public abstract class Screen {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String route = null;
    
    private Screen(java.lang.String route) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getRoute() {
        return null;
    }
    
    @kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u00c6\u0002\u0018\u00002\u00020\u0001B\t\b\u0002\u00a2\u0006\u0004\b\u0002\u0010\u0003\u00a8\u0006\u0004"}, d2 = {"Lru/dachakalend/app/navigation/Screen$Calendar;", "Lru/dachakalend/app/navigation/Screen;", "<init>", "()V", "app_debug"})
    public static final class Calendar extends ru.dachakalend.app.navigation.Screen {
        @org.jetbrains.annotations.NotNull()
        public static final ru.dachakalend.app.navigation.Screen.Calendar INSTANCE = null;
        
        private Calendar() {
        }
    }
    
    @kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u00c6\u0002\u0018\u00002\u00020\u0001B\t\b\u0002\u00a2\u0006\u0004\b\u0002\u0010\u0003\u00a8\u0006\u0004"}, d2 = {"Lru/dachakalend/app/navigation/Screen$Harvest;", "Lru/dachakalend/app/navigation/Screen;", "<init>", "()V", "app_debug"})
    public static final class Harvest extends ru.dachakalend.app.navigation.Screen {
        @org.jetbrains.annotations.NotNull()
        public static final ru.dachakalend.app.navigation.Screen.Harvest INSTANCE = null;
        
        private Harvest() {
        }
    }
    
    @kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u00c6\u0002\u0018\u00002\u00020\u0001B\t\b\u0002\u00a2\u0006\u0004\b\u0002\u0010\u0003\u00a8\u0006\u0004"}, d2 = {"Lru/dachakalend/app/navigation/Screen$Plantings;", "Lru/dachakalend/app/navigation/Screen;", "<init>", "()V", "app_debug"})
    public static final class Plantings extends ru.dachakalend.app.navigation.Screen {
        @org.jetbrains.annotations.NotNull()
        public static final ru.dachakalend.app.navigation.Screen.Plantings INSTANCE = null;
        
        private Plantings() {
        }
    }
    
    @kotlin.Metadata(mv = {2, 2, 0}, k = 1, xi = 48, d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u00c6\u0002\u0018\u00002\u00020\u0001B\t\b\u0002\u00a2\u0006\u0004\b\u0002\u0010\u0003\u00a8\u0006\u0004"}, d2 = {"Lru/dachakalend/app/navigation/Screen$Today;", "Lru/dachakalend/app/navigation/Screen;", "<init>", "()V", "app_debug"})
    public static final class Today extends ru.dachakalend.app.navigation.Screen {
        @org.jetbrains.annotations.NotNull()
        public static final ru.dachakalend.app.navigation.Screen.Today INSTANCE = null;
        
        private Today() {
        }
    }
}