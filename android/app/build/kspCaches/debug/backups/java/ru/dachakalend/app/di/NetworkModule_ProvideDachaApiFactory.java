package ru.dachakalend.app.di;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import retrofit2.Retrofit;
import ru.dachakalend.app.data.api.DachaApi;

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
public final class NetworkModule_ProvideDachaApiFactory implements Factory<DachaApi> {
  private final Provider<Retrofit> retrofitProvider;

  public NetworkModule_ProvideDachaApiFactory(Provider<Retrofit> retrofitProvider) {
    this.retrofitProvider = retrofitProvider;
  }

  @Override
  public DachaApi get() {
    return provideDachaApi(retrofitProvider.get());
  }

  public static NetworkModule_ProvideDachaApiFactory create(Provider<Retrofit> retrofitProvider) {
    return new NetworkModule_ProvideDachaApiFactory(retrofitProvider);
  }

  public static DachaApi provideDachaApi(Retrofit retrofit) {
    return Preconditions.checkNotNullFromProvides(NetworkModule.INSTANCE.provideDachaApi(retrofit));
  }
}
