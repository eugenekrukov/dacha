package ru.dachakalend.app.ui.today;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Provider;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import ru.dachakalend.app.data.repository.TodayRepository;

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
public final class TodayViewModel_Factory implements Factory<TodayViewModel> {
  private final Provider<TodayRepository> repositoryProvider;

  public TodayViewModel_Factory(Provider<TodayRepository> repositoryProvider) {
    this.repositoryProvider = repositoryProvider;
  }

  @Override
  public TodayViewModel get() {
    return newInstance(repositoryProvider.get());
  }

  public static TodayViewModel_Factory create(Provider<TodayRepository> repositoryProvider) {
    return new TodayViewModel_Factory(repositoryProvider);
  }

  public static TodayViewModel newInstance(TodayRepository repository) {
    return new TodayViewModel(repository);
  }
}
