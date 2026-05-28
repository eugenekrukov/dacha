package ru.dachakalend.app.data.repository;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import ru.dachakalend.app.data.api.DachaApi;
import ru.dachakalend.app.data.local.TokenStorage;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava",
    "cast",
    "deprecation",
    "nullness:initialization.field.uninitialized"
})
public final class TodayRepository_Factory implements Factory<TodayRepository> {
  private final Provider<DachaApi> apiProvider;

  private final Provider<TokenStorage> tokenStorageProvider;

  public TodayRepository_Factory(Provider<DachaApi> apiProvider,
      Provider<TokenStorage> tokenStorageProvider) {
    this.apiProvider = apiProvider;
    this.tokenStorageProvider = tokenStorageProvider;
  }

  @Override
  public TodayRepository get() {
    return newInstance(apiProvider.get(), tokenStorageProvider.get());
  }

  public static TodayRepository_Factory create(Provider<DachaApi> apiProvider,
      Provider<TokenStorage> tokenStorageProvider) {
    return new TodayRepository_Factory(apiProvider, tokenStorageProvider);
  }

  public static TodayRepository newInstance(DachaApi api, TokenStorage tokenStorage) {
    return new TodayRepository(api, tokenStorage);
  }
}
