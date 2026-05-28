package ru.dachakalend.app.ui.garden;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import ru.dachakalend.app.data.repository.GardenRepository;

@ScopeMetadata
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
public final class GardenViewModel_Factory implements Factory<GardenViewModel> {
  private final Provider<GardenRepository> gardenRepositoryProvider;

  public GardenViewModel_Factory(Provider<GardenRepository> gardenRepositoryProvider) {
    this.gardenRepositoryProvider = gardenRepositoryProvider;
  }

  @Override
  public GardenViewModel get() {
    return newInstance(gardenRepositoryProvider.get());
  }

  public static GardenViewModel_Factory create(
      Provider<GardenRepository> gardenRepositoryProvider) {
    return new GardenViewModel_Factory(gardenRepositoryProvider);
  }

  public static GardenViewModel newInstance(GardenRepository gardenRepository) {
    return new GardenViewModel(gardenRepository);
  }
}
