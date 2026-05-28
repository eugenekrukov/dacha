package ru.dachakalend.app;

import dagger.MembersInjector;
import dagger.internal.DaggerGenerated;
import dagger.internal.InjectedFieldSignature;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import javax.annotation.processing.Generated;
import ru.dachakalend.app.data.local.TokenStorage;

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
public final class MainActivity_MembersInjector implements MembersInjector<MainActivity> {
  private final Provider<TokenStorage> tokenStorageProvider;

  public MainActivity_MembersInjector(Provider<TokenStorage> tokenStorageProvider) {
    this.tokenStorageProvider = tokenStorageProvider;
  }

  public static MembersInjector<MainActivity> create(Provider<TokenStorage> tokenStorageProvider) {
    return new MainActivity_MembersInjector(tokenStorageProvider);
  }

  @Override
  public void injectMembers(MainActivity instance) {
    injectTokenStorage(instance, tokenStorageProvider.get());
  }

  @InjectedFieldSignature("ru.dachakalend.app.MainActivity.tokenStorage")
  public static void injectTokenStorage(MainActivity instance, TokenStorage tokenStorage) {
    instance.tokenStorage = tokenStorage;
  }
}
