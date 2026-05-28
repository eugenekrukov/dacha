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
public final class GardenRepository_Factory implements Factory<GardenRepository> {
  private final Provider<DachaApi> apiProvider;

  private final Provider<TokenStorage> tokenStorageProvider;

  public GardenRepository_Factory(Provider<DachaApi> apiProvider,
      Provider<TokenStorage> tokenStorageProvider) {
    this.apiProvider = apiProvider;
    this.tokenStorageProvider = tokenStorageProvider;
  }

  @Override
  public GardenRepository get() {
    return newInstance(apiProvider.get(), tokenStorageProvider.get());
  }

  public static GardenRepository_Factory create(Provider<DachaApi> apiProvider,
      Provider<TokenStorage> tokenStorageProvider) {
    return new GardenRepository_Factory(apiProvider, tokenStorageProvider);
  }

  public static GardenRepository newInstance(DachaApi api, TokenStorage tokenStorage) {
    return new GardenRepository(api, tokenStorage);
  }
}
