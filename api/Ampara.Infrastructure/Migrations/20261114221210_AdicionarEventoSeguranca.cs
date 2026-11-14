using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarEventoSeguranca : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "evento_seguranca",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Campo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Classe = table.Column<string>(type: "text", nullable: false),
                    CorrelationId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Decisao = table.Column<string>(type: "text", nullable: false),
                    Em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    MensagemCidadao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Sink = table.Column<string>(type: "text", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    UsuarioAlvoId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evento_seguranca", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_evento_seguranca_UsuarioAlvoId_Em",
                table: "evento_seguranca",
                columns: new[] { "UsuarioAlvoId", "Em" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "evento_seguranca");
        }
    }
}
