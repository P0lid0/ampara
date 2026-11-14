using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Acompanhamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BoNumero",
                table: "Ocorrencias",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BoStatus",
                table: "Ocorrencias",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "nao_registrado");

            migrationBuilder.AddColumn<string>(
                name: "Recuperacao",
                table: "Ocorrencias",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "sem_noticia");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BoNumero",
                table: "Ocorrencias");

            migrationBuilder.DropColumn(
                name: "BoStatus",
                table: "Ocorrencias");

            migrationBuilder.DropColumn(
                name: "Recuperacao",
                table: "Ocorrencias");
        }
    }
}
