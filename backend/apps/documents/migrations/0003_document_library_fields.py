from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_documentchunk"),
        ("implementation", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="is_reference",
            field=models.BooleanField(
                default=False,
                help_text="True para documentos de la biblioteca de referencia global.",
            ),
        ),
        migrations.AlterField(
            model_name="document",
            name="project",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name="documents",
                to="implementation.project",
            ),
        ),
    ]
